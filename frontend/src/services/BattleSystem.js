// BattleSystem.js - PvP Version
export class BattleSystem {
  constructor(player1Stats, player2Stats, player1Powers, player2Powers, onBattleUpdate, onBattleEnd) {
    this.player1 = {
      ...player1Stats,
      currentHp: player1Stats.hp,
      maxHp: player1Stats.hp,
      lastAttackTime: 0,
      name: 'Player 1',
      powers: player1Powers || [],
      // Estados específicos dos poderes
      powerStates: this.initializePowerStates(),
      powerCooldowns: new Map()
    };

    this.player2 = {
      ...player2Stats,
      currentHp: player2Stats.hp,
      maxHp: player2Stats.hp,
      lastAttackTime: 0,
      name: 'Player 2',
      powers: player2Powers || [],
      // Estados específicos dos poderes
      powerStates: this.initializePowerStates(),
      powerCooldowns: new Map()
    };

    this.onBattleUpdate = onBattleUpdate;
    this.onBattleEnd = onBattleEnd;
    this.battleActive = false;
    this.animationId = null;
    this.battleStartTime = 0;
    this.battleLog = [];
  }

  // Inicializa estados específicos para cada poder
  initializePowerStates() {
    return {
      // Faca Rápida - sem estado especial
      facaRapida: {},
      
      // Ataque Perfuro-Cortante - sem estado especial
      perfuroCortante: {},
      
      // Frenesi - controle de duração
      frenesi: {
        active: false,
        endTime: 0
      },
      
      // Fúria - controle de stacks
      furia: {
        stacks: 0
      },
      
      // Berserker - controle de ativação
      berserker: {
        active: false
      },
      
      // Reflexão Total - controle de próximo ataque
      reflexao: {
        nextReflection: false
      },
      
      // Guardião Imortal - uso único
      guardiao: {
        used: false
      }
    };
  }

  // Calcula velocidade de ataque considerando Frenesi
  getAttackInterval(player) {
    let speed = player.speed;
    
    // Verifica Frenesi ativo
    if (player.powerStates.frenesi.active && Date.now() < player.powerStates.frenesi.endTime) {
      speed *= 2;
    } else if (player.powerStates.frenesi.active) {
      // Frenesi expirou
      player.powerStates.frenesi.active = false;
    }
    
    return 1000 / speed;
  }

  // Verifica se pode ativar um poder
  canActivatePower(power, player, context = {}) {
    const now = Date.now();
    
    // Verifica cooldown
    if (player.powerCooldowns.has(power.id)) {
      const cooldownEnd = player.powerCooldowns.get(power.id);
      if (now < cooldownEnd) return false;
    }

    // Verificações específicas por poder
    switch (power.name) {
      case 'Berserker':
        const hpPercent = (player.currentHp / player.maxHp) * 100;
        return hpPercent < 30 && !player.powerStates.berserker.active;
      
      case 'Guardião Imortal':
        return context.isLethalDamage && !player.powerStates.guardiao.used;
      
      case 'Reflexão Total':
        return context.isBeingAttacked;
      
      default:
        // Poderes ofensivos só ativam durante ataques
        return context.isDuringAttack;
    }
  }

  // Tenta ativar poderes antes do ataque
  tryActivatePowers(attacker, defender, context) {
    const activatedPowers = [];
    let powerEffects = {};

    for (const power of attacker.powers) {
      if (this.canActivatePower(power, attacker, context)) {
        // Testa probabilidade de ativação
        if (Math.random() * 100 < power.activation_chance) {
          const effects = this.activatePower(power, attacker, defender, context);
          activatedPowers.push({ power, effects });
          powerEffects = { ...powerEffects, ...effects };
        }
      }
    }

    return { activatedPowers, powerEffects };
  }

  // Ativa um poder específico
  activatePower(power, player, target, context = {}) {
    const now = Date.now();
    
    switch (power.name) {
      case 'Faca Rápida':
        this.addToBattleLog(`💫 ${player.name} ativou ${power.name}!`, true);
        
        // Executa dois ataques com 60% de dano
        const firstHit = this.calculateBasicDamage(player, target, 0.6);
        target.currentHp = Math.max(0, target.currentHp - firstHit.damage);
        this.addAttackLog(player, target, firstHit, 'Faca Rápida (1/2)');
        
        if (target.currentHp > 0) {
          const secondHit = this.calculateBasicDamage(player, target, 0.6);
          target.currentHp = Math.max(0, target.currentHp - secondHit.damage);
          this.addAttackLog(player, target, secondHit, 'Faca Rápida (2/2)');
        }
        
        this.setCooldown(power, player, now);
        return { skipNormalAttack: true };

      case 'Ataque Perfuro-Cortante':
        this.addToBattleLog(`🗡️ ${player.name} ativou ${power.name}!`, true);
        this.setCooldown(power, player, now);
        return { ignoreDefense: true };

      case 'Frenesi':
        player.powerStates.frenesi.active = true;
        player.powerStates.frenesi.endTime = now + 3000;
        this.addToBattleLog(`💨 ${player.name} ativou ${power.name}! Velocidade dobrada por 3s!`, true);
        this.setCooldown(power, player, now);
        break;

      case 'Fúria':
        player.powerStates.furia.stacks = 2;
        const hpLoss = Math.floor(player.maxHp * 0.1);
        player.currentHp = Math.max(1, player.currentHp - hpLoss);
        this.addToBattleLog(`🔥 ${player.name} ativou ${power.name}! +30% crítico por 2 ataques. Perdeu ${hpLoss} HP!`, true);
        this.setCooldown(power, player, now);
        break;

      case 'Berserker':
        player.powerStates.berserker.active = true;
        this.addToBattleLog(`😤 ${player.name} ativou ${power.name}! +20% dano!`, true);
        break;

      case 'Reflexão Total':
        player.powerStates.reflexao.nextReflection = true;
        this.addToBattleLog(`🛡️ ${player.name} ativou ${power.name}! Próximo dano será refletido!`, true);
        this.setCooldown(power, player, now);
        break;

      case 'Guardião Imortal':
        player.currentHp = 1;
        player.powerStates.guardiao.used = true;
        this.addToBattleLog(`💀 ${player.name} ativou ${power.name}! Sobreviveu com 1 HP!`, true);
        return { survivedLethalDamage: true };
    }

    return {};
  }

  // Define cooldown do poder
  setCooldown(power, player, currentTime) {
    if (power.cooldown && power.cooldown > 0) {
      player.powerCooldowns.set(power.id, currentTime + (power.cooldown * 1000));
    }
  }

  // Calcula dano básico (usado pela Faca Rápida)
  calculateBasicDamage(attacker, defender, damageMultiplier = 1.0) {
    let baseDamage = attacker.attack * damageMultiplier;

    // Berserker
    if (attacker.powerStates.berserker.active) {
      const hpPercent = (attacker.currentHp / attacker.maxHp) * 100;
      if (hpPercent < 30) {
        baseDamage *= 1.2;
      }
    }

    // Crítico base
    const isCritical = Math.random() * 100 < attacker.critical;
    let damage = baseDamage;
    
    if (isCritical) {
      damage *= 2;
    }

    // Defesa
    const defenseReduction = defender.defense / 10;
    damage = Math.max(1, Math.floor(damage * (1 - defenseReduction / 100)));

    return {
      damage: Math.floor(damage),
      isCritical,
      originalDamage: Math.floor(baseDamage)
    };
  }

  // Calcula dano completo com poderes
  calculateDamage(attacker, defender, powerEffects = {}) {
    let baseDamage = attacker.attack;

    // Berserker
    if (attacker.powerStates.berserker.active) {
      const hpPercent = (attacker.currentHp / attacker.maxHp) * 100;
      if (hpPercent < 30) {
        baseDamage *= 1.2;
      }
    }

    // Crítico base + Fúria
    let criticalChance = attacker.critical;
    
    if (attacker.powerStates.furia.stacks > 0) {
      criticalChance += 30;
      attacker.powerStates.furia.stacks--;
    }

    const isCritical = Math.random() * 100 < criticalChance;
    let damage = baseDamage;
    
    if (isCritical) {
      damage *= 2;
    }

    // Defesa (ignorar se Perfuro-Cortante)
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
      powerEffects
    };
  }

  // Executa um ataque completo
  performAttack(attacker, defender) {
    // Verifica poderes ofensivos ANTES do ataque
    const { activatedPowers, powerEffects } = this.tryActivatePowers(
      attacker, 
      defender, 
      { isDuringAttack: true }
    );

    // Se algum poder especial executou o ataque (ex: Faca Rápida)
    if (powerEffects.skipNormalAttack) {
      return;
    }

    // Calcula dano do ataque normal
    const attackResult = this.calculateDamage(attacker, defender, powerEffects);
    let finalDamage = attackResult.damage;

    // Verifica Guardião Imortal antes de aplicar dano fatal
    if ((defender.currentHp - finalDamage) <= 0) {
      const guardiao = defender.powers.find(p => p.name === 'Guardião Imortal');
      if (guardiao && !defender.powerStates.guardiao.used) {
        if (this.canActivatePower(guardiao, defender, { isLethalDamage: true })) {
          if (Math.random() * 100 < guardiao.activation_chance) {
            const effects = this.activatePower(guardiao, defender, attacker, { isLethalDamage: true });
            if (effects.survivedLethalDamage) {
              this.addAttackLog(attacker, defender, { ...attackResult, damage: defender.currentHp - 1 });
              return;
            }
          }
        }
      }
    }

    // Verifica Reflexão Total antes de aplicar dano
    let shouldReflect = false;
    if (defender.powerStates.reflexao.nextReflection) {
      shouldReflect = true;
      defender.powerStates.reflexao.nextReflection = false;
    } else {
      // Tenta ativar Reflexão Total
      const reflexao = defender.powers.find(p => p.name === 'Reflexão Total');
      if (reflexao && this.canActivatePower(reflexao, defender, { isBeingAttacked: true })) {
        if (Math.random() * 100 < reflexao.activation_chance) {
          this.activatePower(reflexao, defender, attacker, { isBeingAttacked: true });
          shouldReflect = true;
        }
      }
    }

    // Aplica dano
    defender.currentHp = Math.max(0, defender.currentHp - finalDamage);
    this.addAttackLog(attacker, defender, attackResult);

    // Aplica reflexão
    if (shouldReflect) {
      attacker.currentHp = Math.max(0, attacker.currentHp - finalDamage);
      this.addToBattleLog(`🛡️ Refletiu ${finalDamage} de dano!`, true);
    }
  }

  // Adiciona entrada ao log
  addToBattleLog(message, isPowerActivation = false) {
    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      message,
      isPowerActivation,
      type: 'system'
    });
  }

  // Log de ataque
  addAttackLog(attacker, defender, attackResult, attackName = 'Attack') {
    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      attacker: attacker.name,
      defender: defender.name,
      damage: attackResult.damage,
      isCritical: attackResult.isCritical,
      remainingHp: defender.currentHp,
      attackName,
      type: 'attack'
    });
  }

  // Verifica fim da batalha
  checkBattleEnd() {
    const player1Dead = this.player1.currentHp <= 0;
    const player2Dead = this.player2.currentHp <= 0;

    if (player1Dead && player2Dead) {
      return { result: 'draw', reason: 'both_died' };
    } else if (player1Dead) {
      return { result: 'player2_victory', reason: 'player1_died' };
    } else if (player2Dead) {
      return { result: 'player1_victory', reason: 'player2_died' };
    }

    return null;
  }

  // Loop principal da batalha
  battleLoop = (currentTime) => {
    if (!this.battleActive) return;

    const player1AttackInterval = this.getAttackInterval(this.player1);
    const player2AttackInterval = this.getAttackInterval(this.player2);

    let updated = false;

    // Player 1 ataca
    if (currentTime - this.player1.lastAttackTime >= player1AttackInterval) {
      this.performAttack(this.player1, this.player2);
      this.player1.lastAttackTime = currentTime;
      updated = true;
    }

    // Player 2 ataca
    if (currentTime - this.player2.lastAttackTime >= player2AttackInterval) {
      this.performAttack(this.player2, this.player1);
      this.player2.lastAttackTime = currentTime;
      updated = true;
    }

    // Atualiza UI
    if (updated) {
      this.onBattleUpdate({
        player1: { 
          ...this.player1,
          hpPercent: (this.player1.currentHp / this.player1.maxHp) * 100
        },
        player2: { 
          ...this.player2,
          hpPercent: (this.player2.currentHp / this.player2.maxHp) * 100
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

    this.animationId = requestAnimationFrame(this.battleLoop);
  };

  // Inicia batalha
  startBattle() {
    this.battleActive = true;
    this.battleStartTime = Date.now();
    this.player1.lastAttackTime = 0;
    this.player2.lastAttackTime = 0;
    this.battleLog = [];

    // Reset estados dos poderes
    this.player1.powerStates = this.initializePowerStates();
    this.player2.powerStates = this.initializePowerStates();
    this.player1.powerCooldowns.clear();
    this.player2.powerCooldowns.clear();

    this.addToBattleLog('⚔️ Batalha PvP iniciada!', false);

    this.onBattleUpdate({
      player1: { 
        ...this.player1,
        hpPercent: (this.player1.currentHp / this.player1.maxHp) * 100
      },
      player2: { 
        ...this.player2,
        hpPercent: (this.player2.currentHp / this.player2.maxHp) * 100
      },
      log: [...this.battleLog]
    });

    this.animationId = requestAnimationFrame(this.battleLoop);
  }

  // Finaliza batalha
  endBattle(result) {
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const battleDuration = Date.now() - this.battleStartTime;
    
    let message = '';
    switch (result.result) {
      case 'player1_victory':
        message = '🏆 Player 1 Venceu!';
        break;
      case 'player2_victory':
        message = '🏆 Player 2 Venceu!';
        break;
      case 'draw':
        message = '⚖️ Empate!';
        break;
    }
    
    this.addToBattleLog(message, false);

    this.onBattleEnd({
      ...result,
      duration: battleDuration,
      log: [...this.battleLog],
      finalStats: {
        player1: { ...this.player1 },
        player2: { ...this.player2 }
      }
    });
  }

  // Para batalha
  stopBattle() {
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  // Stats atuais
  getBattleStats() {
    return {
      player1: {
        hpPercent: (this.player1.currentHp / this.player1.maxHp) * 100,
        ...this.player1
      },
      player2: {
        hpPercent: (this.player2.currentHp / this.player2.maxHp) * 100,
        ...this.player2
      },
      log: [...this.battleLog]
    };
  }
}