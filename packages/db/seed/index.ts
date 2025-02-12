import { faker } from '@faker-js/faker';
import { PrismaClient, type Challenge, type Prisma } from '@prisma/client';
import uuidByString from 'uuid-by-string';
import { loadChallengesFromTypeChallenge } from '../mocks/challenges.mock';
import CommentMock from '../mocks/comment.mock';
import UserMock from '../mocks/user.mock';

const prisma = new PrismaClient();

const usersToBeMade = Array.from({ length: 15 }, () => UserMock());
const alotOfSharedSolutions = (challengeId: number) =>
  Array.from({ length: 50 }, () => ({
    challengeId,
    title: faker.lorem.words(7),
    description: faker.lorem.words({ min: 5, max: 25 }),
  }));

await prisma.user.createMany({
  data: usersToBeMade,
});

// Load the challenges.
const data = await loadChallengesFromTypeChallenge();
const users = await prisma.user
  .findMany({
    select: {
      id: true,
    },
  })
  .then((r) => r.map((u) => u.id));

await prisma.challenge.createMany({
  data: data.map((challenge) => ({
    ...challenge,
    userId: faker.helpers.arrayElement(users),
  })),
});

export const trashId = uuidByString('trash');
export const gId = uuidByString('g');

const TRACK_AMOUNT = 10;
for (let i = 0; i < TRACK_AMOUNT; i++) {
  const challenges = await getRandomChallenges(i);

  const track = await prisma.track.create({
    data: {
      title: faker.lorem.words(2),
      description: faker.lorem.sentences(1),
      visible: true,
    },
  });

  await prisma.trackChallenge.createMany({
    data: challenges.map((challenge, index) => ({
      challengeId: challenge.id,
      trackId: track.id,
      orderId: index,
    })),
  });
}

try {
  const someChallenge = await prisma.challenge.findFirst({
    where: {
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { id: trashId },
    update: {},
    create: {
      id: trashId,
      email: 'chris@typehero.dev',
      name: 'chris',
      sharedSolution: {
        create: alotOfSharedSolutions(someChallenge?.id ?? 2),
      },
    },
  });

  let commentNum = 0;
  const comments = Array.from({ length: 50 }, () => CommentMock(++commentNum));

  const replies: Prisma.CommentCreateManyInput[] = [];

  const { comment: createdComments } = await prisma.challenge.update({
    where: { id: someChallenge?.id },
    include: {
      comment: true,
    },
    data: {
      comment: {
        create: comments,
      },
    },
  });

  for (const comment of createdComments) {
    replies.push(CommentMock(++commentNum, comment.id), CommentMock(++commentNum, comment.id));
  }

  await prisma.challenge.update({
    where: { id: someChallenge?.id },
    data: {
      comment: {
        create: replies,
      },
    },
  });

  await prisma.$disconnect();
} catch (e) {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
}

async function getRandomChallenges(iteration: number): Promise<Challenge[]> {
  const challenges = await prisma.challenge.findMany({
    take: 10,
    skip: 10 * iteration,
  });
  return challenges;
}
