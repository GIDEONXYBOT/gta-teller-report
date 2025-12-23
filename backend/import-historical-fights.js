// Script to import historical fight data (fights 1-15)
const historicalFights = [
  {
    id: 1,
    batch: { fightSequence: 1 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 25000,
      blueTotalBetAmount: 18000,
      drawTotalBetAmount: 0,
      redOdds: '1.6500',
      blueOdds: '2.2000',
      drawOdds: 8
    }
  },
  {
    id: 2,
    batch: { fightSequence: 2 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 22000,
      blueTotalBetAmount: 28000,
      drawTotalBetAmount: 0,
      redOdds: '2.1000',
      blueOdds: '1.7500',
      drawOdds: 8
    }
  },
  {
    id: 3,
    batch: { fightSequence: 3 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 30000,
      blueTotalBetAmount: 15000,
      drawTotalBetAmount: 0,
      redOdds: '1.4500',
      blueOdds: '2.8000',
      drawOdds: 8
    }
  },
  {
    id: 4,
    batch: { fightSequence: 4 },
    result1: 'draw',
    details: {
      redTotalBetAmount: 20000,
      blueTotalBetAmount: 20000,
      drawTotalBetAmount: 5000,
      redOdds: '1.9000',
      blueOdds: '1.9000',
      drawOdds: 8
    }
  },
  {
    id: 5,
    batch: { fightSequence: 5 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 18000,
      blueTotalBetAmount: 32000,
      drawTotalBetAmount: 0,
      redOdds: '2.5000',
      blueOdds: '1.5500',
      drawOdds: 8
    }
  },
  {
    id: 6,
    batch: { fightSequence: 6 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 35000,
      blueTotalBetAmount: 12000,
      drawTotalBetAmount: 0,
      redOdds: '1.3500',
      blueOdds: '3.2000',
      drawOdds: 8
    }
  },
  {
    id: 7,
    batch: { fightSequence: 7 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 15000,
      blueTotalBetAmount: 35000,
      drawTotalBetAmount: 0,
      redOdds: '2.8000',
      blueOdds: '1.4200',
      drawOdds: 8
    }
  },
  {
    id: 8,
    batch: { fightSequence: 8 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 28000,
      blueTotalBetAmount: 20000,
      drawTotalBetAmount: 0,
      redOdds: '1.7200',
      blueOdds: '2.0500',
      drawOdds: 8
    }
  },
  {
    id: 9,
    batch: { fightSequence: 9 },
    result1: 'draw',
    details: {
      redTotalBetAmount: 24000,
      blueTotalBetAmount: 24000,
      drawTotalBetAmount: 3000,
      redOdds: '1.8500',
      blueOdds: '1.8500',
      drawOdds: 8
    }
  },
  {
    id: 10,
    batch: { fightSequence: 10 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 19000,
      blueTotalBetAmount: 31000,
      drawTotalBetAmount: 0,
      redOdds: '2.3500',
      blueOdds: '1.6200',
      drawOdds: 8
    }
  },
  {
    id: 11,
    batch: { fightSequence: 11 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 32000,
      blueTotalBetAmount: 16000,
      drawTotalBetAmount: 0,
      redOdds: '1.5200',
      blueOdds: '2.6500',
      drawOdds: 8
    }
  },
  {
    id: 12,
    batch: { fightSequence: 12 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 21000,
      blueTotalBetAmount: 29000,
      drawTotalBetAmount: 0,
      redOdds: '2.2000',
      blueOdds: '1.6800',
      drawOdds: 8
    }
  },
  {
    id: 13,
    batch: { fightSequence: 13 },
    result1: 'meron',
    details: {
      redTotalBetAmount: 27000,
      blueTotalBetAmount: 22000,
      drawTotalBetAmount: 0,
      redOdds: '1.7800',
      blueOdds: '1.9800',
      drawOdds: 8
    }
  },
  {
    id: 14,
    batch: { fightSequence: 14 },
    result1: 'draw',
    details: {
      redTotalBetAmount: 23000,
      blueTotalBetAmount: 23000,
      drawTotalBetAmount: 4000,
      redOdds: '1.9200',
      blueOdds: '1.9200',
      drawOdds: 8
    }
  },
  {
    id: 15,
    batch: { fightSequence: 15 },
    result1: 'wala',
    details: {
      redTotalBetAmount: 17000,
      blueTotalBetAmount: 33000,
      drawTotalBetAmount: 0,
      redOdds: '2.6500',
      blueOdds: '1.4800',
      drawOdds: 8
    }
  }
];

console.log('Historical fights data prepared for import:');
console.log(`Total fights: ${historicalFights.length}`);
console.log(`Fight sequences: ${historicalFights[0].batch.fightSequence} to ${historicalFights[historicalFights.length - 1].batch.fightSequence}`);

// To import this data, make a POST request to /api/external-betting/import-historical
// with { fights: historicalFights }

export { historicalFights };