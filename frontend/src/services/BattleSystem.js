// BattleSystem.js
export class BattleSystem {
  constructor(playerStats, enemyStats, playerPowers, onBattleUpdate, onBattleEnd) {
    this.player = {
      ...playerStats,
      currentHp: playerStats.hp,
      maxHp: playerStats.hp,
      lastAttackTime: 0,
      name: 'Player',
      powers: playerPowers || [],
      // Estados dos poderes
      powerCooldowns: new Map(),
      berserkerActive: false,
      guardianImmortalUsed: false,
      frenesiEndTime: 0,
      furiaStacks: 0
    };

    this.enemy = {
      ...enemyStats,
      currentHp: enemyStats.hp,
      maxHp: enemyStats.hp,
      lastAttackTime: 0,
      name: 'Enemy'
    };

    this.onBattleUpdate = onBattleUpdate;
    this.onBattleEnd = onBattleEnd;
    this.battleActive = false;
    this.animationId = null;
    this.battleStartTime = 0;
    this.battleLog = [];
  }

  // Calcula o intervalo entre ataques baseado na velocidade
  getAttackInterval(speed) {
    // Verifica se o Frenesi está ativo
    if (this.player.frenesiEndTime > Date.now()) {
      speed *= 2; // Dobra a velocidade durante o Frenesi
    }
    return 1000 / speed;
  }

  // Verifica se um poder deve ser ativado
  shouldActivatePower(power) {
    const now = Date.now();
    
    // Verifica cooldown (se houver)
    if (this.player.powerCooldowns.has(power.id)) {
      const cooldownEnd = this.player.powerCooldowns.get(power.id);
      if (now < cooldownEnd) {
        return false;
      }
    }

    // Verifica condições especiais
    switch (power.name) {
      case 'Berserker':
        // Só ativa se HP < 30% e ainda não está ativo
        const hpPercent = (this.player.currentHp / this.player.maxHp) * 100;
        return hpPercent < 30 && !this.player.berserkerActive;
      
      case 'Guardião Imortal':
        // Só ativa quando recebe golpe fatal e ainda não foi usado
        return !this.player.guardianImmortalUsed;
      
      default:
        // Usa chance de ativação padrão
        return Math.random() * 100 < power.activation_chance;
    }
  }

  // Ativa um poder específico
  activatePower(power, context = {}) {
    const now = Date.now();
    
    switch (power.name) {
      case 'Faca Rápida':
        // Golpeia duas vezes com 60% do dano
        this.addToBattleLog(`💫 ${power.name} activated!`, true);
        const firstHit = this.calculateDamage(this.player, this.enemy, 0.6);
        const secondHit = this.calculateDamage(this.player, this.enemy, 0.6);
        
        this.enemy.currentHp = Math.max(0, this.enemy.currentHp - firstHit.damage);
        this.addAttackLog(this.player, this.enemy, firstHit);
        
        if (this.enemy.currentHp > 0) {
          this.enemy.currentHp = Math.max(0, this.enemy.currentHp - secondHit.damage);
          this.addAttackLog(this.player, this.enemy, secondHit);
        }
        break;

      case 'Ataque Perfuro-Cortante':
        // Ignora defesa - será usado no cálculo de dano
        this.addToBattleLog(`🗡️ ${power.name} activated! Defense ignored!`, true);
        return { ignoreDefense: true };

      case 'Frenesi':
        // Duplica velocidade por 3 segundos
        this.player.frenesiEndTime = now + 3000;
        this.addToBattleLog(`💨 ${power.name} activated! Speed doubled for 3 seconds!`, true);
        break;

      case 'Fúria':
        // +30% crítico nos próximos 2 ataques, perde 10% HP
        this.player.furiaStacks = 2;
        const hpLoss = Math.floor(this.player.maxHp * 0.1);
        this.player.currentHp = Math.max(1, this.player.currentHp - hpLoss);
        this.addToBattleLog(`🔥 ${power.name} activated! +30% critical for 2 attacks. Lost ${hpLoss} HP!`, true);
        break;

      case 'Berserker':
        // +20% dano quando HP < 30%
        this.player.berserkerActive = true;
        this.addToBattleLog(`😤 ${power.name} activated! +20% damage while HP is low!`, true);
        break;

      case 'Reflexão Total':
        // Devolve 100% do dano - será usado quando receber dano
        this.addToBattleLog(`🛡️ ${power.name} activated! Next damage will be reflected!`, true);
        return { reflectDamage: true };

      case 'Guardião Imortal':
        // Resiste com 1 HP ao golpe fatal
        this.player.currentHp = 1;
        this.player.guardianImmortalUsed = true;
        this.addToBattleLog(`💀 ${power.name} activated! Survived with 1 HP!`, true);
        break;
    }

    return {};
  }

  // Calcula dano com crítico e poderes
  calculateDamage(attacker, defender, damageMultiplier = 1.0, powerEffects = {}) {
    let baseDamage = attacker.attack * damageMultiplier;

    // Aplica Berserker se ativo (jogador apenas)
    if (attacker.name === 'Player' && this.player.berserkerActive) {
      const hpPercent = (this.player.currentHp / this.player.maxHp) * 100;
      if (hpPercent < 30) {
        baseDamage *= 1.2;
      }
    }

    // Calcula crítico
    let criticalChance = attacker.critical;
    
    // Aplica bônus de Fúria se ativo (jogador apenas)
    if (attacker.name === 'Player' && this.player.furiaStacks > 0) {
      criticalChance += 30;
      this.player.furiaStacks--;
    }

    const isCritical = Math.random() * 100 < criticalChance;
    let damage = baseDamage;
    
    if (isCritical) {
      damage *= 2;
    }

    // Aplica redução de defesa (se não ignorar)
    if (!powerEffects.ignoreDefense) {
      const defenseReduction = defender.defense / 10;
      damage = Math.max(1, Math.floor(damage * (1 - defenseReduction / 100)));
    } else {
      damage = Math.max(1, Math.floor(damage));
    }

    return {
      damage: Math.floor(damage),
      isCritical,
      originalDamage: Math.floor(baseDamage),
      defenseReduction: powerEffects.ignoreDefense ? 0 : defender.defense / 10,
      powerEffects
    };
  }

  // Adiciona entrada ao log de batalha
  addToBattleLog(message, isPowerActivation = false) {
    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      message,
      isPowerActivation,
      type: 'system'
    });
  }

  // Adiciona log de ataque
  addAttackLog(attacker, defender, attackResult) {
    const attackerText = attacker.name === 'Player' ? 'You' : 'Enemy';
    const defenderText = defender.name === 'Player' ? 'you' : 'enemy';

    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      attacker: attackerText,
      defender: defenderText,
      damage: attackResult.damage,
      isCritical: attackResult.isCritical,
      remainingHp: defender.currentHp,
      type: 'attack'
    });
  }

  // Executa um ataque com sistema de poderes
  performAttack(attacker, defender) {
    let powerEffects = {};
    let reflectDamage = false;

    // Se o atacante é o jogador, verifica poderes antes do ataque
    if (attacker.name === 'Player') {
      // Verifica todos os poderes equipados
      for (const power of this.player.powers) {
        if (this.shouldActivatePower(power)) {
          const effects = this.activatePower(power);
          powerEffects = { ...powerEffects, ...effects };
        }
      }

      // Verifica se Faca Rápida foi ativada (ela já faz os ataques internamente)
      const facaRapidaActivated = this.player.powers.some(power => 
        power.name === 'Faca Rápida' && this.shouldActivatePower(power)
      );
      
      if (facaRapidaActivated) {
        return; // Faca Rápida já executou os ataques
      }
    }

    // Se o defensor é o jogador, verifica Reflexão Total
    if (defender.name === 'Player') {
      const reflexaoTotal = this.player.powers.find(power => power.name === 'Reflexão Total');
      if (reflexaoTotal && this.shouldActivatePower(reflexaoTotal)) {
        const effects = this.activatePower(reflexaoTotal);
        reflectDamage = effects.reflectDamage;
      }
    }

    // Calcula o dano do ataque
    const attackResult = this.calculateDamage(attacker, defender, 1.0, powerEffects);
    let finalDamage = attackResult.damage;

    // Verifica Guardião Imortal antes de aplicar dano fatal
    if (defender.name === 'Player' && (defender.currentHp - finalDamage) <= 0) {
      const guardiao = this.player.powers.find(power => power.name === 'Guardião Imortal');
      if (guardiao && !this.player.guardianImmortalUsed && this.shouldActivatePower(guardiao)) {
        this.activatePower(guardiao);
        return; // Guardião Imortal já ajustou o HP
      }
    }

    // Aplica dano
    defender.currentHp = Math.max(0, defender.currentHp - finalDamage);

    // Log do ataque
    this.addAttackLog(attacker, defender, attackResult);

    // Aplica reflexão se ativa
    if (reflectDamage && attacker.name === 'Enemy') {
      attacker.currentHp = Math.max(0, attacker.currentHp - finalDamage);
      this.addToBattleLog(`🛡️ Reflected ${finalDamage} damage back to enemy!`, true);
    }
  }

  // Verifica se a batalha acabou
  checkBattleEnd() {
    const playerDead = this.player.currentHp <= 0;
    const enemyDead = this.enemy.currentHp <= 0;

    if (playerDead && enemyDead) {
      return { result: 'defeat', reason: 'both_died' };
    } else if (playerDead) {
      return { result: 'defeat', reason: 'player_died' };
    } else if (enemyDead) {
      return { result: 'victory', reason: 'enemy_died' };
    }

    return null;
  }

  // Loop principal da batalha
  battleLoop = (currentTime) => {
    if (!this.battleActive) return;

    const playerAttackInterval = this.getAttackInterval(this.player.speed);
    const enemyAttackInterval = this.getAttackInterval(this.enemy.speed);

    let playerAttacked = false;
    let enemyAttacked = false;

    // Verifica se o jogador pode atacar
    if (currentTime - this.player.lastAttackTime >= playerAttackInterval) {
      this.performAttack(this.player, this.enemy);
      this.player.lastAttackTime = currentTime;
      playerAttacked = true;
    }

    // Verifica se o inimigo pode atacar
    if (currentTime - this.enemy.lastAttackTime >= enemyAttackInterval) {
      this.performAttack(this.enemy, this.player);
      this.enemy.lastAttackTime = currentTime;
      enemyAttacked = true;
    }

    // Atualiza a UI se houve algum ataque
    if (playerAttacked || enemyAttacked) {
      this.onBattleUpdate({
        player: { 
          ...this.player,
          hpPercent: (this.player.currentHp / this.player.maxHp) * 100
        },
        enemy: { 
          ...this.enemy,
          hpPercent: (this.enemy.currentHp / this.enemy.maxHp) * 100
        },
        log: [...this.battleLog]
      });
    }

    // Verifica fim da batalha
    const battleResult = this.checkBattleEnd();
    if (battleResult) {
      this.endBattle(battleResult);
      return;
    }

    // Continua o loop
    this.animationId = requestAnimationFrame(this.battleLoop);
  };

  // Inicia a batalha
  startBattle() {
    this.battleActive = true;
    this.battleStartTime = Date.now();
    this.player.lastAttackTime = 0;
    this.enemy.lastAttackTime = 0;
    this.battleLog = [];

    // Reset dos estados dos poderes
    this.player.powerCooldowns.clear();
    this.player.berserkerActive = false;
    this.player.guardianImmortalUsed = false;
    this.player.frenesiEndTime = 0;
    this.player.furiaStacks = 0;

    this.addToBattleLog('⚔️ Battle begins!', false);

    // Primeira atualização
    this.onBattleUpdate({
      player: { 
        ...this.player,
        hpPercent: (this.player.currentHp / this.player.maxHp) * 100
      },
      enemy: { 
        ...this.enemy,
        hpPercent: (this.enemy.currentHp / this.enemy.maxHp) * 100
      },
      log: [...this.battleLog]
    });

    // Inicia o loop
    this.animationId = requestAnimationFrame(this.battleLoop);
  }

  // Termina a batalha
  endBattle(result) {
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const battleDuration = Date.now() - this.battleStartTime;
    
    // Log final
    this.addToBattleLog(
      result.result === 'victory' ? '🏆 Victory!' : '💀 Defeat!', 
      false
    );

    this.onBattleEnd({
      ...result,
      duration: battleDuration,
      log: [...this.battleLog],
      finalStats: {
        player: { ...this.player },
        enemy: { ...this.enemy }
      }
    });
  }

  // Para a batalha manualmente
  stopBattle() {
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  // Obtém estatísticas da batalha
  getBattleStats() {
    return {
      player: {
        hpPercent: (this.player.currentHp / this.player.maxHp) * 100,
        ...this.player
      },
      enemy: {
        hpPercent: (this.enemy.currentHp / this.enemy.maxHp) * 100,
        ...this.enemy
      },
      log: [...this.battleLog]
    };
  }
}