export const ENEMIES = {
  1: {
    id: 1,
    name: 'Orc Warrior',
    type: 'warrior',
    level: 1,
    hp: 850,
    attack: 75,
    defense: 80,
    critical: 25,
    speed: 1,
    xpReward: 50,
    goldReward: 25,
    description: 'A fierce orc warrior with brutal strength and heavy armor.',
    image: 'orc-warrior.png',
    abilities: ['Rage Strike', 'Shield Bash'],
    weaknesses: ['magic', 'speed'],
    resistances: ['physical']
  },
  2: {
    id: 2,
    name: 'Shadow Assassin',
    type: 'assassin',
    level: 2,
    hp: 700,
    attack: 95,
    defense: 55,
    critical: 35,
    speed: 1.2,
    xpReward: 75,
    goldReward: 40,
    description: 'A deadly assassin that strikes from the shadows with precision.',
    image: 'shadow-assassin.png',
    abilities: ['Stealth Strike', 'Poison Blade'],
    weaknesses: ['defense', 'tank'],
    resistances: ['critical', 'speed']
  },
  3: {
    id: 3,
    name: 'Ice Golem',
    type: 'tank',
    level: 3,
    hp: 1300,
    attack: 75,
    defense: 260,
    critical: 30,
    speed: 1,
    xpReward: 100,
    goldReward: 60,
    description: 'A massive ice construct with incredible defensive capabilities.',
    image: 'ice-golem.png',
    abilities: ['Frost Armor', 'Ice Slam'],
    weaknesses: ['fire', 'critical'],
    resistances: ['physical', 'ice']
  },
  4: {
    id: 4,
    name: 'Dragon Knight',
    type: 'boss',
    level: 5,
    hp: 1500,
    attack: 100,
    defense: 300,
    critical: 50,
    speed: 1,
    xpReward: 200,
    goldReward: 100,
    description: 'An elite dragon knight with balanced stats and powerful abilities.',
    image: 'dragon-knight.png',
    abilities: ['Dragon Breath', 'Knight\'s Honor', 'Fire Slash'],
    weaknesses: ['ice', 'holy'],
    resistances: ['fire', 'dark']
  }
};

export const getEnemyById = (id) => {
  return ENEMIES[id] || null;
};

export const getAllEnemies = () => {
  return Object.values(ENEMIES);
};

export const getEnemiesByType = (type) => {
  return Object.values(ENEMIES).filter(enemy => enemy.type === type);
};

export const getEnemiesByLevel = (minLevel, maxLevel) => {
  return Object.values(ENEMIES).filter(enemy => 
    enemy.level >= minLevel && enemy.level <= maxLevel
  );
};