// BattleSystem.js
export class BattleSystem {
  constructor(playerStats, enemyStats, onBattleUpdate, onBattleEnd) {
    this.player = {
      ...playerStats,
      currentHp: playerStats.hp,
      maxHp: playerStats.hp,
      lastAttackTime: 0,
      name: 'Player'
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
    return 1000 / speed; // 1.0 speed = 1000ms, 1.2 speed = 833ms, etc.
  }

  // Calcula dano com crítico
  calculateDamage(attacker, defender) {
    const baseDamage = attacker.attack;
    
    // Verifica crítico
    const criticalChance = attacker.critical;
    const isCritical = Math.random() * 100 < criticalChance;
    
    let damage = baseDamage;
    if (isCritical) {
      damage *= 2;
    }
    
    // Aplica redução de defesa (defense/10 = % de redução)
    const defenseReduction = defender.defense / 10;
    const finalDamage = Math.max(1, Math.floor(damage * (1 - defenseReduction / 100)));
    
    return {
      damage: finalDamage,
      isCritical,
      originalDamage: damage,
      defenseReduction
    };
  }

  // Executa um ataque
  performAttack(attacker, defender) {
    const attackResult = this.calculateDamage(attacker, defender);
    defender.currentHp = Math.max(0, defender.currentHp - attackResult.damage);
    
    // Adiciona ao log
    this.battleLog.push({
      timestamp: Date.now() - this.battleStartTime,
      attacker: attacker.name,
      defender: defender.name,
      damage: attackResult.damage,
      isCritical: attackResult.isCritical,
      remainingHp: defender.currentHp
    });
    
    return attackResult;
  }

  // Verifica se a batalha acabou
  checkBattleEnd() {
    const playerDead = this.player.currentHp <= 0;
    const enemyDead = this.enemy.currentHp <= 0;
    
    if (playerDead && enemyDead) {
      // Ambos mortos = derrota
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
        player: { ...this.player },
        enemy: { ...this.enemy },
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
    
    // Primeira atualização
    this.onBattleUpdate({
      player: { ...this.player },
      enemy: { ...this.enemy },
      log: []
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