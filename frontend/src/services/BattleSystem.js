// BattleSystem.js - PvP Version Corrigida
export class BattleSystem {
  constructor(player1Stats, player2Stats, player1Powers = [], player2Powers = [], onBattleUpdate, onBattleEnd) {
    this.player1 = {
      ...player1Stats,
      currentHp: player1Stats.hp,
      maxHp: player1Stats.hp,
      lastAttackTime: 0,
      name: 'Player 1',
      powers: this.normalizePowers(player1Powers),
      powerStates: this.initializePowerStates(),
      powerCooldowns: new Map()
    };

    this.player2 = {
      ...player2Stats,
      currentHp: player2Stats.hp,
      maxHp: player2Stats.hp,
      lastAttackTime: 0,
      name: 'Player 2',
      powers: this.normalizePowers(player2Powers),
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

  // Normaliza poderes para garantir estrutura consistente
  normalizePowers(powers) {
    if (!powers || !Array.isArray(powers)) return [];
    
    return powers.filter(power => power && typeof power === 'object' && power.name).map(power => ({
      id: power.id || Math.random(),
      name: power.name,
      description: power.description || '',
      activation_chance: power.activation_chance || 100,
      icon: power.icon || '⚡',
      cooldown: power.cooldown || 0
    }));
  }

  // Inicializa estados específicos para cada poder
  initializePowerStates() {
    return {
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
    let speed = player.speed || 1.0;
    
    // Verifica Frenesi ativo
    if (player.powerStates.frenesi.active && Date.now() < player.powerStates.frenesi.endTime) {
      speed *= 2;
      this.addToBattleLog(`💨 ${player.name} está em Frenesi! Velocidade dobrada!`);
    } else if (player.powerStates.frenesi.active) {
      // Frenesi expirou
      player.powerStates.frenesi.active = false;
      this.addToBattleLog(`💨 Frenesi de ${player.name} terminou.`);
    }
    
    // Converte para intervalo em ms (mínimo 500ms, máximo 3000ms)
    const interval = Math.max(500, Math.min(3000, 1000 / speed));
    return interval;
  }

  // Verifica se pode ativar um poder
  canActivatePower(power, player, context = {}) {
    if (!power || !power.name) return false;
    
    const now = Date.now();
    
    // Verifica cooldown
    const cooldownKey = `${power.id || power.name}_${player.name}`;
    if (player.powerCooldowns.has(cooldownKey)) {
      const cooldownEnd = player.powerCooldowns.get(cooldownKey);
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
        return context.isDuringAttack || context.isBeingAttacked;
    }
  }

  // Tenta ativar poderes
  tryActivatePowers(attacker, defender, context) {
    const activatedPowers = [];
    let powerEffects = {};

    // Verifica poderes defensivos do defensor primeiro
    if (context.isBeingAttacked) {
      for (const power of defender.powers) {
        if (this.canActivatePower(power, defender, context)) {
          // Testa probabilidade de ativação
          if (Math.random() * 100 < power.activation_chance) {
            const effects = this.activatePower(power, defender, attacker, context);
            activatedPowers.push({ power, effects, player: defender });
            powerEffects = { ...powerEffects, ...effects };
          }
        }
      }
    }

    // Verifica poderes ofensivos do atacante
    if (context.isDuringAttack) {
      for (const power of attacker.powers) {
        if (this.canActivatePower(power, attacker, context)) {
          // Testa probabilidade de ativação
          if (Math.random() * 100 < power.activation_chance) {
            const effects = this.activatePower(power, attacker, defender, context);
            activatedPowers.push({ power, effects, player: attacker });
            powerEffects = { ...powerEffects, ...effects };
          }
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
        
        // Executa dois ataques com 60% de dano cada
        setTimeout(() => {
          const firstHit = this.calculateBasicDamage(player, target, 0.6);
          target.currentHp = Math.max(0, target.currentHp - firstHit.damage);
          this.addAttackLog(player, target, firstHit, 'Faca Rápida (1/2)');
          
          if (target.currentHp > 0) {
            setTimeout(() => {
              const secondHit = this.calculateBasicDamage(player, target, 0.6);
              target.currentHp = Math.max(0, target.currentHp - secondHit.damage);
              this.addAttackLog(player, target, secondHit, 'Faca Rápida (2/2)');
            }, 200);
          }
        }, 100);
        
        this.setCooldown(power, player, now + 5000); // 5s cooldown
        return { skipNormalAttack: true };

      case 'Ataque Perfuro-Cortante':
        this.addToBattleLog(`🗡️ ${player.name} ativou ${power.name}!`, true);
        this.setCooldown(power, player, now + 3000); // 3s cooldown
        return { ignoreDefense: true };

      case 'Frenesi':
        player.powerStates.frenesi.active = true;
        player.powerStates.frenesi.endTime = now + 3000;
        this.addToBattleLog(`💨 ${player.name} ativou ${power.name}! Velocidade dobrada por 3s!`, true);
        this.setCooldown(power, player, now + 10000); // 10s cooldown
        return { speedBoost: true };

      case 'Fúria':
        player.powerStates.furia.stacks = 2;
        const hpLoss = Math.floor(player.maxHp * 0.1);
        player.currentHp = Math.max(1, player.currentHp - hpLoss);
        this.addToBattleLog(`🔥 ${player.name} ativou ${power.name}! +30% crítico por 2 ataques. Perdeu ${hpLoss} HP!`, true);
        this.setCooldown(power, player, now + 8000); // 8s cooldown
        return { criticalBoost: true };

      case 'Berserker':
        player.powerStates.berserker.active = true;
        this.addToBattleLog(`😤 ${player.name} ativou ${power.name}! +20% dano quando HP < 30%!`, true);
        return { damageBoost: true };

      case 'Reflexão Total':
        player.powerStates.reflexao.nextReflection = true;
        this.addToBattleLog(`🛡️ ${player.name} ativou ${power.name}! Próximo dano será refletido 100%!`, true);
        this.setCooldown(power, player, now + 12000); // 12s cooldown
        return { reflection: true };

      case 'Guardião Imortal':
        player.currentHp = 1;
        player.powerStates.guardiao.used = true;
        this.addToBattleLog(`💀 ${player.name} ativou ${power.name}! Sobreviveu com 1 HP!`, true);
        return { survivedLethalDamage: true };
    }

    return {};
  }

  // Define cooldown do poder
  setCooldown(power, player, endTime) {
    const cooldownKey = `${power.id || power.name}_${player.name}`;
    player.powerCooldowns.set(cooldownKey, endTime);
  }

  // Calcula dano básico (usado pela Faca Rápida)
  calculateBasicDamage(attacker, defender, damageMultiplier = 1.0) {
    let baseDamage = (attacker.attack || 50) * damageMultiplier;

    // Aplicar Berserker se ativo
    if (attacker.powerStates.berserker.active) {
      const hpPercent = (attacker.currentHp / attacker.maxHp) * 100;
      if (hpPercent < 30) {
        baseDamage *= 1.2;
      }
    }

    // Calcular crítico
    let criticalChance = attacker.critical || 5;
    const isCritical = Math.random() * 100 < criticalChance;
    
    if (isCritical) {
      baseDamage *= 2;
    }

    // Aplicar defesa
    const defenseReduction = Math.min(90, (defender.defense || 10) / 10); // Máximo 90% redução
    const finalDamage = Math.max(1, Math.floor(baseDamage * (1 - defenseReduction / 100)));

    return {
      damage: finalDamage,
      isCritical,
      originalDamage: Math.floor(baseDamage)
    };
  }

  // Calcula dano completo com poderes
  calculateDamage(attacker, defender, powerEffects = {}) {
    let baseDamage = attacker.attack || 50;

    // Aplicar Berserker
    if (attacker.powerStates.berserker.active) {
      const hpPercent = (attacker.currentHp / attacker.maxHp) * 100;
      if (hpPercent < 30) {
        baseDamage *= 1.2;
      }
    }

    // Calcular crítico com Fúria
    let criticalChance = attacker.critical || 5;
    
    if (attacker.powerStates.furia.stacks > 0) {
      criticalChance += 30;
      attacker.powerStates.furia.stacks--;
      if (attacker.powerStates.furia.stacks === 0) {
        this.addToBattleLog(`🔥 Fúria de ${attacker.name} terminou.`);
      }
    }

    const isCritical = Math.random() * 100 < criticalChance;
    
    if (isCritical) {
      baseDamage *= 2;
    }

    // Aplicar defesa (ignorar se Perfuro-Cortante)
    let finalDamage = baseDamage;
    if (!powerEffects.ignoreDefense) {
      const defenseReduction = Math.min(90, (defender.defense || 10) / 10);
      finalDamage = Math.max(1, Math.floor(baseDamage * (1 - defenseReduction / 100)));
    } else {
      finalDamage = Math.max(1, Math.floor(baseDamage));
    }

    return {
      damage: finalDamage,
      isCritical,
      originalDamage: Math.floor(baseDamage),
      powerEffects
    };
  }

  // Executa um ataque completo
  performAttack(attacker, defender) {
    // Primeiro, verificar poderes defensivos do defensor
    const { powerEffects: defensivePowers } = this.tryActivatePowers(
      attacker, 
      defender, 
      { isBeingAttacked: true }
    );

    // Verificar poderes ofensivos do atacante
    const { powerEffects: offensivePowers } = this.tryActivatePowers(
      attacker, 
      defender, 
      { isDuringAttack: true }
    );

    const allPowerEffects = { ...defensivePowers, ...offensivePowers };

    // Se algum poder especial executou o ataque (ex: Faca Rápida)
    if (allPowerEffects.skipNormalAttack) {
      return;
    }

    // Calcular dano do ataque normal
    const attackResult = this.calculateDamage(attacker, defender, allPowerEffects);
    let finalDamage = attackResult.damage;

    // Verificar Guardião Imortal antes de aplicar dano fatal
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

    // Verificar e aplicar reflexão
    let reflectedDamage = 0;
    if (defender.powerStates.reflexao.nextReflection) {
      reflectedDamage = finalDamage;
      defender.powerStates.reflexao.nextReflection = false;
      this.addToBattleLog(`🛡️ ${defender.name} refletiu ${reflectedDamage} de dano para ${attacker.name}!`);
    }

    // Aplicar dano ao defensor
    defender.currentHp = Math.max(0, defender.currentHp - finalDamage);
    this.addAttackLog(attacker, defender, attackResult);

    // Aplicar dano refletido ao atacante
    if (reflectedDamage > 0) {
      attacker.currentHp = Math.max(0, attacker.currentHp - reflectedDamage);
    }
  }

  // Adiciona entrada ao log
  addToBattleLog(message, isPowerActivation = false) {
    if (!this.battleStartTime) this.battleStartTime = Date.now();
    
    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      message,
      isPowerActivation,
      type: 'system'
    });
  }

  // Log de ataque
  addAttackLog(attacker, defender, attackResult, attackName = 'Attack') {
    if (!this.battleStartTime) this.battleStartTime = Date.now();
    
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
      return { result: 'draw', winner: null, reason: 'both_died' };
    } else if (player1Dead) {
      return { result: 'player2_victory', winner: 'player2', reason: 'player1_died' };
    } else if (player2Dead) {
      return { result: 'player1_victory', winner: 'player1', reason: 'player2_died' };
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
      if (this.player2.currentHp > 0) {
        this.performAttack(this.player1, this.player2);
        this.player1.lastAttackTime = currentTime;
        updated = true;
      }
    }

    // Player 2 ataca
    if (currentTime - this.player2.lastAttackTime >= player2AttackInterval) {
      if (this.player1.currentHp > 0) {
        this.performAttack(this.player2, this.player1);
        this.player2.lastAttackTime = currentTime;
        updated = true;
      }
    }

    // Atualizar UI se houve mudanças
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

    // Verificar fim da batalha
    const battleResult = this.checkBattleEnd();
    if (battleResult) {
      this.endBattle(battleResult);
      return;
    }

    // Continuar loop
    this.animationId = requestAnimationFrame(this.battleLoop);
  };

  // Inicia batalha
  startBattle() {
    console.log('Iniciando batalha PvP...');
    console.log('Player 1:', this.player1);
    console.log('Player 2:', this.player2);
    
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

    // Ativar Berserker se HP < 30%
    [this.player1, this.player2].forEach(player => {
      const hpPercent = (player.currentHp / player.maxHp) * 100;
      if (hpPercent < 30) {
        const berserker = player.powers.find(p => p.name === 'Berserker');
        if (berserker && !player.powerStates.berserker.active) {
          this.activatePower(berserker, player, null, {});
        }
      }
    });

    this.addToBattleLog(`⚔️ Batalha PvP iniciada! ${this.player1.name} vs ${this.player2.name}!`);

    // Atualização inicial
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

    // Iniciar loop da batalha
    this.animationId = requestAnimationFrame(this.battleLoop);
  }

  // Finaliza batalha
  endBattle(result) {
    console.log('Finalizando batalha:', result);
    
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const battleDuration = Date.now() - this.battleStartTime;
    
    let message = '';
    switch (result.result) {
      case 'player1_victory':
        message = `🏆 ${this.player1.name} Venceu!`;
        break;
      case 'player2_victory':
        message = `🏆 ${this.player2.name} Venceu!`;
        break;
      case 'draw':
        message = '⚖️ Empate! Ambos os jogadores caíram!';
        break;
    }
    
    this.addToBattleLog(message);

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
    console.log('Parando batalha...');
    this.battleActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  // Stats atuais da batalha
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
      log: [...this.battleLog],
      isActive: this.battleActive
    };
  }
}