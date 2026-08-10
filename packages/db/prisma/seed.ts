import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаем заполнение базы данных...');

  // 1. Организация
  const org = await prisma.organization.create({
    data: {
      name: 'ВК Ярославич',
      code: 'YAROSLAVICH',
    },
  });
  console.log('✓ Организация создана:', org.name);

  // 2. Команда
  const team = await prisma.team.create({
    data: {
      name: 'Ярославич (основной состав)',
      code: 'YAR_MAIN',
      organizationId: org.id,
    },
  });
  console.log('✓ Команда создана:', team.name);

  // 3. Сезон
  const season = await prisma.season.create({
    data: {
      name: '2026/27',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
      teams: { connect: { id: team.id } },
    },
  });
  console.log('✓ Сезон создан:', season.name);

  // 4. Игроки
  const players = await Promise.all([
    prisma.player.create({
      data: {
        playerId: 'P001',
        firstName: 'Иван',
        lastName: 'Петров',
        middleName: 'Сергеевич',
        position: 'outside_hitter',
        birthDate: new Date('1998-03-15'),
        height: 198,
        status: 'ACTIVE',
        joinedDate: new Date('2020-08-01'),
        teamId: team.id,
      },
    }),
    prisma.player.create({
      data: {
        playerId: 'P002',
        firstName: 'Алексей',
        lastName: 'Смирнов',
        middleName: 'Владимирович',
        position: 'opposite',
        birthDate: new Date('1996-07-22'),
        height: 201,
        status: 'ACTIVE',
        joinedDate: new Date('2018-08-01'),
        teamId: team.id,
      },
    }),
    prisma.player.create({
      data: {
        playerId: 'P003',
        firstName: 'Дмитрий',
        lastName: 'Козлов',
        middleName: 'Андреевич',
        position: 'setter',
        birthDate: new Date('1999-11-08'),
        height: 192,
        status: 'ACTIVE',
        joinedDate: new Date('2021-08-01'),
        teamId: team.id,
      },
    }),
    prisma.player.create({
      data: {
        playerId: 'P004',
        firstName: 'Михаил',
        lastName: 'Волков',
        middleName: 'Игоревич',
        position: 'libero',
        birthDate: new Date('2000-05-30'),
        height: 185,
        status: 'INJURED',
        joinedDate: new Date('2022-08-01'),
        teamId: team.id,
      },
    }),
  ]);
  console.log('✓ Создано 4 игрока');

  // 5. Тесты
  const tests = await Promise.all([
    prisma.test.create({
      data: {
        code: 'STR_PULL',
        name: 'Становая тяга',
        category: 'STRENGTH',
        direction: 'HIGHER_IS_BETTER',
        unit: 'kg',
        qcMin: 80,
        qcMax: 250,
      },
    }),
    prisma.test.create({
      data: {
        code: 'STR_SQUAT',
        name: 'Приседания со штангой',
        category: 'STRENGTH',
        direction: 'HIGHER_IS_BETTER',
        unit: 'kg',
        qcMin: 60,
        qcMax: 220,
      },
    }),
    prisma.test.create({
      data: {
        code: 'PWR_CMJ',
        name: 'Прыжок вверх (CMJ)',
        category: 'POWER',
        direction: 'HIGHER_IS_BETTER',
        unit: 'cm',
        qcMin: 20,
        qcMax: 80,
      },
    }),
    prisma.test.create({
      data: {
        code: 'PWR_BJ',
        name: 'Прыжок в длину с места',
        category: 'POWER',
        direction: 'HIGHER_IS_BETTER',
        unit: 'cm',
        qcMin: 180,
        qcMax: 320,
      },
    }),
    prisma.test.create({
      data: {
        code: 'SPD_10',
        name: 'Спринт 10 м',
        category: 'SPEED',
        direction: 'LOWER_IS_BETTER',
        unit: 'sec',
        qcMin: 1.4,
        qcMax: 2.2,
      },
    }),
    prisma.test.create({
      data: {
        code: 'SPD_20',
        name: 'Спринт 20 м',
        category: 'SPEED',
        direction: 'LOWER_IS_BETTER',
        unit: 'sec',
        qcMin: 2.8,
        qcMax: 4.0,
      },
    }),
    prisma.test.create({
      data: {
        code: 'AGI_TTEST',
        name: 'T-тест',
        category: 'AGILITY',
        direction: 'LOWER_IS_BETTER',
        unit: 'sec',
        qcMin: 8.5,
        qcMax: 12.0,
      },
    }),
    prisma.test.create({
      data: {
        code: 'AGI_505',
        name: '505 тест',
        category: 'AGILITY',
        direction: 'LOWER_IS_BETTER',
        unit: 'sec',
        qcMin: 2.0,
        qcMax: 3.5,
      },
    }),
    prisma.test.create({
      data: {
        code: 'VB_APP',
        name: 'Нападающий удар (высота)',
        category: 'VOLLEYBALL',
        direction: 'HIGHER_IS_BETTER',
        unit: 'cm',
        qcMin: 280,
        qcMax: 370,
      },
    }),
    prisma.test.create({
      data: {
        code: 'VB_BLOCK',
        name: 'Блок (высота)',
        category: 'VOLLEYBALL',
        direction: 'HIGHER_IS_BETTER',
        unit: 'cm',
        qcMin: 270,
        qcMax: 350,
      },
    }),
    prisma.test.create({
      data: {
        code: 'VB_SERVE',
        name: 'Скорость подачи',
        category: 'VOLLEYBALL',
        direction: 'HIGHER_IS_BETTER',
        unit: 'km/h',
        qcMin: 70,
        qcMax: 140,
      },
    }),
    prisma.test.create({
      data: {
        code: 'MOB_OHS',
        name: 'Присед с палкой над головой',
        category: 'MOBILITY_STABILITY',
        direction: 'CONTEXTUAL',
        unit: 'score',
        qcMin: 0,
        qcMax: 10,
      },
    }),
    prisma.test.create({
      data: {
        code: 'MOB_SL',
        name: 'Выпад в линию',
        category: 'MOBILITY_STABILITY',
        direction: 'CONTEXTUAL',
        unit: 'score',
        qcMin: 0,
        qcMax: 10,
      },
    }),
    prisma.test.create({
      data: {
        code: 'BC_MASS',
        name: 'Масса тела',
        category: 'BODY_COMPOSITION',
        direction: 'CONTEXTUAL',
        unit: 'kg',
        qcMin: 60,
        qcMax: 120,
      },
    }),
    prisma.test.create({
      data: {
        code: 'BC_FAT',
        name: 'Процент жира',
        category: 'BODY_COMPOSITION',
        direction: 'LOWER_IS_BETTER',
        unit: '%',
        qcMin: 5,
        qcMax: 25,
      },
    }),
    prisma.test.create({
      data: {
        code: 'BC_FFM',
        name: 'Безжировая масса',
        category: 'BODY_COMPOSITION',
        direction: 'HIGHER_IS_BETTER',
        unit: 'kg',
        qcMin: 50,
        qcMax: 100,
      },
    }),
  ]);
  console.log('✓ Создано 16 тестов');

  // 6. Сессии (8 сессий на двух датах)
  const sessions = [];
  const dates = [new Date('2026-07-14'), new Date('2026-08-05')];
  
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < dates.length; j++) {
      const sessionNum = i * 2 + j + 1;
      const session = await prisma.testSession.create({
        data: {
          sessionId: `S${String(sessionNum).padStart(3, '0')}`,
          DateTime: dates[j],
          phase: 'CAMP',
          status: sessionNum === 5 ? 'PARTIAL' : 'FULL',
          source: 'MANUAL',
          playerId: players[i].id,
          teamId: team.id,
          seasonId: season.id,
        },
      });
      sessions.push(session);
    }
  }
  console.log('✓ Создано 8 сессий');

  // 7. Демо-результаты
  const testData = [
    { code: 'STR_PULL', base: 140, variance: 20 },
    { code: 'STR_SQUAT', base: 120, variance: 18 },
    { code: 'PWR_CMJ', base: 45, variance: 8 },
    { code: 'PWR_BJ', base: 260, variance: 25 },
    { code: 'SPD_10', base: 1.75, variance: 0.12 },
    { code: 'SPD_20', base: 3.2, variance: 0.2 },
    { code: 'AGI_TTEST', base: 9.8, variance: 0.6 },
    { code: 'AGI_505', base: 2.6, variance: 0.25 },
    { code: 'VB_APP', base: 335, variance: 15 },
    { code: 'VB_BLOCK', base: 320, variance: 12 },
    { code: 'VB_SERVE', base: 95, variance: 12 },
    { code: 'MOB_OHS', base: 7, variance: 2 },
    { code: 'MOB_SL', base: 8, variance: 1.5 },
    { code: 'BC_MASS', base: 85, variance: 10 },
    { code: 'BC_FAT', base: 12, variance: 3 },
    { code: 'BC_FFM', base: 75, variance: 8 },
  ];

  let resultsCount = 0;
  for (const session of sessions) {
    if (session.sessionId === 'S005') {
      // Частичная сессия — только 8 тестов
      const partialTests = tests.slice(0, 8);
      for (const test of partialTests) {
        const testDataItem = testData.find(t => t.code === test.code);
        if (testDataItem) {
          const value = testDataItem.base + (Math.random() - 0.5) * testDataItem.variance * 2;
          await prisma.testResult.create({
            data: {
              value: Number(value.toFixed(2)),
              testId: test.id,
              playerId: session.playerId,
              testSessionId: session.id,
            },
          });
          resultsCount++;
        }
      }
    } else {
      // Полная сессия — все 16 тестов
      for (const test of tests) {
        const testDataItem = testData.find(t => t.code === test.code);
        if (testDataItem) {
          const value = testDataItem.base + (Math.random() - 0.5) * testDataItem.variance * 2;
          await prisma.testResult.create({
            data: {
              value: Number(value.toFixed(2)),
              testId: test.id,
              playerId: session.playerId,
              testSessionId: session.id,
            },
          });
          resultsCount++;
        }
      }
    }
  }
  console.log(`✓ Создано ${resultsCount} результатов тестирования`);

  // 8. Нормативы (демо)
  const positions = ['outside_hitter', 'opposite', 'setter', 'libero'];
  let normsCount = 0;
  for (const test of tests) {
    for (const pos of positions) {
      const testDataItem = testData.find(t => t.code === test.code);
      if (testDataItem) {
        await prisma.norm.create({
          data: {
            testCode: test.code,
            position: pos,
            anchor10: testDataItem.base - testDataItem.variance * 1.5,
            anchor25: testDataItem.base - testDataItem.variance * 0.8,
            anchor50: testDataItem.base,
            anchor75: testDataItem.base + testDataItem.variance * 0.8,
            anchor90: testDataItem.base + testDataItem.variance * 1.5,
            source: 'ДЕМО — заменить реальными данными',
            testId: test.id,
          },
        });
        normsCount++;
      }
    }
  }
  console.log(`✓ Создано ${normsCount} нормативов`);

  // 9. Цели игроков
  const goalTests = tests.filter(t => ['PWR_CMJ', 'SPD_10', 'VB_APP'].includes(t.code));
  let goalsCount = 0;
  for (const player of players) {
    for (const test of goalTests) {
      const testDataItem = testData.find(t => t.code === test.code);
      if (testDataItem) {
        const targetValue = test.direction === 'LOWER_IS_BETTER'
          ? testDataItem.base - testDataItem.variance * 0.3
          : testDataItem.base + testDataItem.variance * 0.3;
        
        await prisma.playerGoal.create({
          data: {
            playerId: player.id,
            testId: test.id,
            targetValue: Number(targetValue.toFixed(2)),
            targetDate: new Date('2027-01-31'),
          },
        });
        goalsCount++;
      }
    }
  }
  console.log(`✓ Создано ${goalsCount} целей`);

  console.log('\n✅ База данных успешно заполнена демо-данными!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });