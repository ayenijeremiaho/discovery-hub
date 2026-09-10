import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from '../entity/game.entity';
import { GameQuestion } from '../entity/game-question.entity';
import { GameSession } from '../entity/game-session.entity';
import { GameParticipant } from '../entity/game-participant.entity';
import { GameResponse } from '../entity/game-response.entity';
import {
  GameSessionStatusEnum,
  GameStatusEnum,
} from '../enum/game-status.enum';
import { AuditLogService } from '../../utility/service/audit-log.service';

const mockAdmin = { id: 'admin-1' } as any;

const mockGameRepo = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockQuestionRepo = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};

const mockSessionRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockParticipantRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  query: jest.fn(),
};

const mockResponseRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockAuditLogService = { log: jest.fn() };

// A chainable stand-in for TypeORM's QueryBuilder — every builder method
// used by game.service.ts's raw-aggregate queries (listGameSessions,
// getMyGameHistory) returns `this`, so tests only need to configure the
// terminal getRawMany/getManyAndCount call. createQueryBuilder is called
// more than once per service method with different expected results (e.g.
// listGameSessions' count query vs. its top-scorer query), so each test
// wires up one builder per expected call via mockReturnValueOnce, in call
// order.
function makeQueryBuilderMock() {
  const builder: any = {
    select: jest.fn(() => builder),
    addSelect: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    innerJoinAndSelect: jest.fn(() => builder),
    leftJoinAndSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    addOrderBy: jest.fn(() => builder),
    distinctOn: jest.fn(() => builder),
    skip: jest.fn(() => builder),
    take: jest.fn(() => builder),
    // Empty-by-default rather than unconfigured (which resolves `undefined`
    // and throws downstream) — a test that doesn't care about this query's
    // result still gets a safe, valid empty response; one that does care
    // overrides with its own mockResolvedValue.
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return builder;
}

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: every test that touches listGames/getGame gets a real,
    // empty-by-default play-count query rather than needing to configure
    // one just to avoid a crash — tests asserting an actual count override
    // this per-call via mockReturnValueOnce.
    mockSessionRepo.createQueryBuilder.mockReturnValue(makeQueryBuilderMock());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: getRepositoryToken(Game), useValue: mockGameRepo },
        {
          provide: getRepositoryToken(GameQuestion),
          useValue: mockQuestionRepo,
        },
        { provide: getRepositoryToken(GameSession), useValue: mockSessionRepo },
        {
          provide: getRepositoryToken(GameParticipant),
          useValue: mockParticipantRepo,
        },
        {
          provide: getRepositoryToken(GameResponse),
          useValue: mockResponseRepo,
        },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();
    service = module.get(GameService);
  });

  describe('createGame', () => {
    it('creates a DRAFT game and logs GAME_CREATED', async () => {
      const saved = { id: 'game-1', title: 'Bible Trivia' };
      mockGameRepo.create.mockReturnValue(saved);
      mockGameRepo.save.mockResolvedValue(saved);

      const result = await service.createGame(
        { title: 'Bible Trivia' } as any,
        mockAdmin,
      );

      expect(mockGameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bible Trivia',
          status: GameStatusEnum.DRAFT,
          createdBy: { id: 'admin-1' },
        }),
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        'GAME_CREATED',
        expect.objectContaining({ actorId: 'admin-1', targetId: 'game-1' }),
      );
      expect(result).toBe(saved);
    });
  });

  describe('addQuestion', () => {
    it('throws BadRequestException when correctOptionIndex is out of range', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      await expect(
        service.addQuestion(
          'game-1',
          {
            questionText: 'Q',
            options: ['A', 'B'],
            correctOptionIndex: 2,
          } as any,
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns the next order based on existing question count', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      mockQuestionRepo.count.mockResolvedValue(2);
      const saved = { id: 'q-1' };
      mockQuestionRepo.create.mockReturnValue(saved);
      mockQuestionRepo.save.mockResolvedValue(saved);

      await service.addQuestion(
        'game-1',
        {
          questionText: 'Q',
          options: ['A', 'B'],
          correctOptionIndex: 0,
        } as any,
        mockAdmin,
      );

      expect(mockQuestionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 2,
          points: 1000,
          timeLimitSeconds: 20,
        }),
      );
    });
  });

  describe('startSession', () => {
    it('throws BadRequestException when the game has no questions', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      mockQuestionRepo.count.mockResolvedValue(0);

      await expect(service.startSession('game-1', mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when a live session already exists for the game', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      mockQuestionRepo.count.mockResolvedValue(3);
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-existing',
        sessionCode: 'GAME-OLD123',
      });

      await expect(service.startSession('game-1', mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('creates a LIVE session in the lobby state (no current question yet) and flips the game status', async () => {
      const game = { id: 'game-1', status: GameStatusEnum.DRAFT };
      mockGameRepo.findOne.mockResolvedValue(game);
      mockQuestionRepo.count.mockResolvedValue(3);
      mockSessionRepo.findOne.mockResolvedValue(null);
      const session = { id: 'sess-1', sessionCode: 'GAME-ABC123' };
      mockSessionRepo.create.mockReturnValue(session);
      mockSessionRepo.save.mockResolvedValue(session);
      mockGameRepo.save.mockResolvedValue(game);

      const result = await service.startSession('game-1', mockAdmin);

      // No question is live yet — members can join and see the code, but
      // nothing's timer starts until the host explicitly reveals Question 1
      // via nextQuestion.
      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GameSessionStatusEnum.LIVE,
          currentQuestionIndex: null,
          currentQuestionStartedAt: null,
        }),
      );
      expect(game.status).toBe(GameStatusEnum.LIVE_SESSION_ACTIVE);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        'GAME_SESSION_STARTED',
        expect.objectContaining({ actorId: 'admin-1' }),
      );
      expect(result).toBe(session);
    });
  });

  describe('nextQuestion', () => {
    it('throws ForbiddenException when the caller is not the host', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'other-admin' },
        game: { id: 'game-1' },
      });
      await expect(
        service.nextQuestion('GAME-ABC123', mockAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the session is not LIVE', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.ENDED,
        hostAdmin: { id: 'admin-1' },
        game: { id: 'game-1' },
      });
      await expect(
        service.nextQuestion('GAME-ABC123', mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already on the last question', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: 1,
        game: { id: 'game-1' },
      });
      mockQuestionRepo.count.mockResolvedValue(2);

      await expect(
        service.nextQuestion('GAME-ABC123', mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('advances currentQuestionIndex and resets the question timer', async () => {
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: 0,
        currentQuestionStartedAt: new Date(Date.now() - 60_000),
        game: { id: 'game-1', title: 'Bible Trivia' },
      };
      mockSessionRepo.findOne.mockResolvedValue(session);
      mockQuestionRepo.count.mockResolvedValue(2);
      mockSessionRepo.save.mockResolvedValue(session);
      mockQuestionRepo.find.mockResolvedValue([
        {
          id: 'q-1',
          order: 0,
          timeLimitSeconds: 20,
          points: 1000,
          options: [],
          questionText: '',
        },
        {
          id: 'q-2',
          order: 1,
          timeLimitSeconds: 20,
          points: 1000,
          options: [],
          questionText: '',
        },
      ]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      const state = await service.nextQuestion('GAME-ABC123', mockAdmin);

      expect(session.currentQuestionIndex).toBe(1);
      expect(state.currentQuestionIndex).toBe(1);
      expect(state.currentQuestion?.id).toBe('q-2');
      expect(state.currentQuestion).not.toHaveProperty('correctOptionIndex');
      // Clients tick their own countdown off this timestamp rather than the
      // secondsRemaining snapshot, which goes stale between broadcasts.
      expect(state.currentQuestionStartedAt).toBe(
        session.currentQuestionStartedAt.getTime(),
      );
      expect(state.gameTitle).toBe('Bible Trivia');
    });

    it('advances from the lobby (null) to question index 0 and starts the timer', async () => {
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: null,
        currentQuestionStartedAt: null,
        game: { id: 'game-1', title: 'Bible Trivia' },
      };
      mockSessionRepo.findOne.mockResolvedValue(session);
      mockQuestionRepo.count.mockResolvedValue(2);
      mockSessionRepo.save.mockResolvedValue(session);
      mockQuestionRepo.find.mockResolvedValue([
        {
          id: 'q-1',
          order: 0,
          timeLimitSeconds: 20,
          points: 1000,
          options: [],
          questionText: '',
        },
      ]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      const state = await service.nextQuestion('GAME-ABC123', mockAdmin);

      expect(session.currentQuestionIndex).toBe(0);
      expect(session.currentQuestionStartedAt).toBeInstanceOf(Date);
      expect(state.currentQuestionIndex).toBe(0);
      expect(state.currentQuestion?.id).toBe('q-1');
    });
  });

  describe('endSession', () => {
    it('marks the session ENDED and reverts the game to DRAFT', async () => {
      const game = { id: 'game-1', status: GameStatusEnum.LIVE_SESSION_ACTIVE };
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: 0,
        game,
      };
      // First call is getSessionOrThrow fetching the session itself; second
      // is the "any other session still LIVE?" check — must return null so
      // the DRAFT reset actually runs.
      mockSessionRepo.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(null);
      mockSessionRepo.save.mockResolvedValue(session);
      mockGameRepo.save.mockResolvedValue(game);
      mockQuestionRepo.find.mockResolvedValue([]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      await service.endSession('GAME-ABC123', mockAdmin);

      expect(session.status).toBe(GameSessionStatusEnum.ENDED);
      expect(game.status).toBe(GameStatusEnum.DRAFT);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        'GAME_SESSION_ENDED',
        expect.objectContaining({ actorId: 'admin-1' }),
      );
    });

    it('does not reset the game to DRAFT if another session is still LIVE', async () => {
      const game = { id: 'game-1', status: GameStatusEnum.LIVE_SESSION_ACTIVE };
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: 0,
        game,
      };
      const otherLiveSession = { id: 'sess-2', sessionCode: 'GAME-OTHER99' };
      mockSessionRepo.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(otherLiveSession);
      mockSessionRepo.save.mockResolvedValue(session);
      mockQuestionRepo.find.mockResolvedValue([]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      await service.endSession('GAME-ABC123', mockAdmin);

      expect(session.status).toBe(GameSessionStatusEnum.ENDED);
      expect(game.status).toBe(GameStatusEnum.LIVE_SESSION_ACTIVE);
      expect(mockGameRepo.save).not.toHaveBeenCalled();
    });

    it('is idempotent — calling twice only logs once', async () => {
      const game = { id: 'game-1', status: GameStatusEnum.DRAFT };
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.ENDED,
        hostAdmin: { id: 'admin-1' },
        currentQuestionIndex: 0,
        game,
      };
      mockSessionRepo.findOne.mockResolvedValue(session);
      mockQuestionRepo.find.mockResolvedValue([]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      await service.endSession('GAME-ABC123', mockAdmin);

      expect(mockSessionRepo.save).not.toHaveBeenCalled();
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    // Deliberately not host-restricted — this is the safety valve for a
    // session whose host closed their tab without ending it themselves.
    it('succeeds for an admin who is not the session host', async () => {
      const game = { id: 'game-1', status: GameStatusEnum.LIVE_SESSION_ACTIVE };
      const session = {
        id: 'sess-1',
        sessionCode: 'GAME-ABC123',
        status: GameSessionStatusEnum.LIVE,
        hostAdmin: { id: 'the-original-host' },
        currentQuestionIndex: 0,
        game,
      };
      mockSessionRepo.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(null);
      mockSessionRepo.save.mockResolvedValue(session);
      mockGameRepo.save.mockResolvedValue(game);
      mockQuestionRepo.find.mockResolvedValue([]);
      mockParticipantRepo.count.mockResolvedValue(0);
      mockResponseRepo.count.mockResolvedValue(0);
      mockParticipantRepo.find.mockResolvedValue([]);

      await expect(
        service.endSession('GAME-ABC123', mockAdmin),
      ).resolves.toBeDefined();
      expect(session.status).toBe(GameSessionStatusEnum.ENDED);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        'GAME_SESSION_ENDED',
        expect.objectContaining({ actorId: mockAdmin.id }),
      );
    });
  });

  describe('joinSession', () => {
    it('throws BadRequestException when the session is not LIVE', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.SCHEDULED,
      });
      await expect(
        service.joinSession('GAME-ABC123', 'member-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new participant when none exists', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.LIVE,
      });
      mockParticipantRepo.findOne.mockResolvedValue(null);
      const participant = { id: 'part-1' };
      mockParticipantRepo.create.mockReturnValue(participant);
      mockParticipantRepo.save.mockResolvedValue(participant);

      const result = await service.joinSession('GAME-ABC123', 'member-1');

      expect(result).toEqual({ participantId: 'part-1' });
    });

    it('returns the existing participant without creating a duplicate', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.LIVE,
      });
      mockParticipantRepo.findOne.mockResolvedValue({ id: 'part-existing' });

      const result = await service.joinSession('GAME-ABC123', 'member-1');

      expect(mockParticipantRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual({ participantId: 'part-existing' });
    });
  });

  describe('submitAnswer', () => {
    const currentQuestion = {
      id: 'q-1',
      order: 0,
      correctOptionIndex: 1,
      points: 1000,
      timeLimitSeconds: 20,
      options: ['A', 'B'],
      questionText: 'Q',
    };

    function mockLiveSession(overrides: Partial<any> = {}) {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.LIVE,
        currentQuestionIndex: 0,
        currentQuestionStartedAt: new Date(),
        game: { id: 'game-1' },
        ...overrides,
      });
      mockQuestionRepo.find.mockResolvedValue([currentQuestion]);
    }

    it('throws BadRequestException when the session is not LIVE', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'sess-1',
        status: GameSessionStatusEnum.ENDED,
      });
      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when answering a non-current question', async () => {
      mockLiveSession();
      await expect(
        service.submitAnswer('GAME-ABC123', 'q-wrong', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the caller never joined the session', async () => {
      mockLiveSession();
      mockParticipantRepo.findOne.mockResolvedValue(null);
      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException on a duplicate answer', async () => {
      mockLiveSession();
      mockParticipantRepo.findOne.mockResolvedValue({
        id: 'part-1',
        totalScore: 0,
      });
      mockResponseRepo.findOne.mockResolvedValue({ id: 'existing-response' });
      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException (not a raw 500) when a concurrent double-submit races past the duplicate check', async () => {
      mockLiveSession();
      mockParticipantRepo.findOne.mockResolvedValue({
        id: 'part-1',
        totalScore: 0,
      });
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('awards 0 points for an incorrect answer', async () => {
      mockLiveSession();
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockResolvedValue({});

      const result = await service.submitAnswer(
        'GAME-ABC123',
        'q-1',
        'member-1',
        {
          selectedOptionIndex: 0,
        } as any,
      );

      expect(result).toEqual({ isCorrect: false, pointsAwarded: 0 });
      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });

    it('awards full points for an instant correct answer', async () => {
      // Date.now() pinned so elapsed time is exactly 0 regardless of how
      // long the test itself takes to run — computeScore reads real wall
      // time, so without this the assertion is flaky under load.
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      mockLiveSession({ currentQuestionStartedAt: new Date(now) });
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockResolvedValue({});

      const result = await service.submitAnswer(
        'GAME-ABC123',
        'q-1',
        'member-1',
        {
          selectedOptionIndex: 1,
        } as any,
      );
      nowSpy.mockRestore();

      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(1000);
      expect(participant.totalScore).toBe(1000);
      expect(mockParticipantRepo.save).toHaveBeenCalledWith(participant);
    });

    it('floors the speed bonus at 50% of base points for a correct answer submitted near the deadline', async () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const startedAt = new Date(now - 19_000); // 19s elapsed of a 20s window
      mockLiveSession({ currentQuestionStartedAt: startedAt });
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockResolvedValue({});

      const result = await service.submitAnswer(
        'GAME-ABC123',
        'q-1',
        'member-1',
        {
          selectedOptionIndex: 1,
        } as any,
      );
      nowSpy.mockRestore();

      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(500);
    });

    it('accepts an answer submitted exactly at the time limit', async () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const startedAt = new Date(now - 20_000); // exactly timeLimitSeconds elapsed
      mockLiveSession({ currentQuestionStartedAt: startedAt });
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockResolvedValue({});

      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).resolves.toEqual({ isCorrect: true, pointsAwarded: 500 });
      nowSpy.mockRestore();
    });

    it('accepts an answer submitted within the grace window past the time limit', async () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const startedAt = new Date(now - 21_000); // 1s into the 2s grace window
      mockLiveSession({ currentQuestionStartedAt: startedAt });
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);
      mockResponseRepo.findOne.mockResolvedValue(null);
      mockResponseRepo.create.mockImplementation((v) => v);
      mockResponseRepo.save.mockResolvedValue({});

      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).resolves.toEqual({ isCorrect: true, pointsAwarded: 500 });
      nowSpy.mockRestore();
    });

    it('rejects an answer submitted past the grace window with a clean 400, not a crash', async () => {
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      const startedAt = new Date(now - 23_000); // 1s past the 2s grace window
      mockLiveSession({ currentQuestionStartedAt: startedAt });
      const participant = { id: 'part-1', totalScore: 0 };
      mockParticipantRepo.findOne.mockResolvedValue(participant);

      await expect(
        service.submitAnswer('GAME-ABC123', 'q-1', 'member-1', {
          selectedOptionIndex: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockResponseRepo.save).not.toHaveBeenCalled();
      nowSpy.mockRestore();
    });
  });

  describe('listGames', () => {
    it('attaches the live session code to whichever games actually have one', async () => {
      const liveGame = {
        id: 'game-1',
        status: GameStatusEnum.LIVE_SESSION_ACTIVE,
      };
      const draftGame = { id: 'game-2', status: GameStatusEnum.DRAFT };
      const qb = makeQueryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([[liveGame, draftGame], 2]);
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([
        {
          sessionCode: 'GAME-LIVE01',
          game: { id: 'game-1' },
        },
      ]);

      const result = await service.listGames(1, 20);

      expect(mockSessionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: GameSessionStatusEnum.LIVE,
          }),
        }),
      );
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'game-1',
          activeSessionCode: 'GAME-LIVE01',
        }),
        expect.objectContaining({ id: 'game-2', activeSessionCode: null }),
      ]);
    });

    it('finds a live session even for a game whose own status wrongly says DRAFT', async () => {
      // Regression coverage: Game.status is a denormalized mirror of "is
      // there a live session" and can drift (e.g. a session left LIVE from
      // before startSession's duplicate-session guard existed). This must
      // still surface the Resume action off the real GameSession row.
      const driftedGame = { id: 'game-1', status: GameStatusEnum.DRAFT };
      const qb = makeQueryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([[driftedGame], 1]);
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([
        { sessionCode: 'GAME-ORPHAN1', game: { id: 'game-1' } },
      ]);

      const result = await service.listGames(1, 20);

      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'game-1',
          activeSessionCode: 'GAME-ORPHAN1',
        }),
      ]);
    });

    it('returns null activeSessionCode when no game has a live session', async () => {
      const qb = makeQueryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([
        [{ id: 'game-2', status: GameStatusEnum.DRAFT }],
        1,
      ]);
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([]);

      const result = await service.listGames(1, 20);

      expect(result.data).toEqual([
        expect.objectContaining({ id: 'game-2', activeSessionCode: null }),
      ]);
    });

    it('attaches a play count from ENDED sessions per game, defaulting to 0', async () => {
      const playedGame = { id: 'game-1', status: GameStatusEnum.DRAFT };
      const neverPlayedGame = { id: 'game-2', status: GameStatusEnum.DRAFT };
      const qb = makeQueryBuilderMock();
      qb.getManyAndCount.mockResolvedValue([[playedGame, neverPlayedGame], 2]);
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([]);
      const playCountBuilder = makeQueryBuilderMock();
      playCountBuilder.getRawMany.mockResolvedValue([
        { gameId: 'game-1', count: 3 },
      ]);
      mockSessionRepo.createQueryBuilder.mockReturnValue(playCountBuilder);

      const result = await service.listGames(1, 20);

      expect(result.data).toEqual([
        expect.objectContaining({ id: 'game-1', playCount: 3 }),
        expect.objectContaining({ id: 'game-2', playCount: 0 }),
      ]);
    });

    it('applies a title/description search filter via ILIKE', async () => {
      const qb = makeQueryBuilderMock();
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([]);

      await service.listGames(1, 20, 'trivia');

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(game.title ILIKE :search OR game.description ILIKE :search)',
        { search: '%trivia%' },
      );
    });

    it('applies a status filter', async () => {
      const qb = makeQueryBuilderMock();
      mockGameRepo.createQueryBuilder.mockReturnValue(qb);
      mockSessionRepo.find.mockResolvedValue([]);

      await service.listGames(1, 20, undefined, GameStatusEnum.DRAFT);

      expect(qb.andWhere).toHaveBeenCalledWith('game.status = :status', {
        status: GameStatusEnum.DRAFT,
      });
    });
  });

  describe('getGame', () => {
    it('includes the active session code for a live game', async () => {
      mockGameRepo.findOne.mockResolvedValue({
        id: 'game-1',
        status: GameStatusEnum.LIVE_SESSION_ACTIVE,
      });
      mockSessionRepo.find.mockResolvedValue([
        { sessionCode: 'GAME-LIVE01', game: { id: 'game-1' } },
      ]);

      const result = await service.getGame('game-1');

      expect(result.activeSessionCode).toBe('GAME-LIVE01');
    });
  });

  describe('getLeaderboard', () => {
    it('returns participants ordered by totalScore desc with member names', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 'sess-1' });
      mockParticipantRepo.find.mockResolvedValue([
        {
          id: 'part-1',
          totalScore: 1500,
          member: { id: 'm-1', firstname: 'Ada', lastname: 'Lovelace' },
        },
      ]);

      const result = await service.getLeaderboard('GAME-ABC123');

      expect(result).toEqual([
        {
          participantId: 'part-1',
          memberId: 'm-1',
          memberName: 'Ada Lovelace',
          totalScore: 1500,
        },
      ]);
    });
  });

  describe('listGameSessions', () => {
    it('zips participant counts and the top scorer onto each session', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      const sessions = [
        {
          id: 'sess-1',
          sessionCode: 'GAME-ABC123',
          status: GameSessionStatusEnum.ENDED,
          startedAt: new Date('2026-01-01'),
          endedAt: new Date('2026-01-01'),
        },
      ];
      mockSessionRepo.findAndCount.mockResolvedValue([sessions, 1]);

      const countBuilder = makeQueryBuilderMock();
      countBuilder.getRawMany.mockResolvedValue([
        { sessionId: 'sess-1', count: 3 },
      ]);
      const topScorerBuilder = makeQueryBuilderMock();
      topScorerBuilder.getRawMany.mockResolvedValue([
        { sessionId: 'sess-1', topScore: 1500, topScorerName: 'Ada Lovelace' },
      ]);
      mockParticipantRepo.createQueryBuilder
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(topScorerBuilder);

      const result = await service.listGameSessions('game-1', 1, 20);

      expect(result.data).toEqual([
        expect.objectContaining({
          sessionCode: 'GAME-ABC123',
          participantCount: 3,
          topScore: 1500,
          topScorerName: 'Ada Lovelace',
        }),
      ]);
    });

    it('returns null topScore/topScorerName for a session with zero participants', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      const sessions = [
        {
          id: 'sess-empty',
          sessionCode: 'GAME-EMPTY1',
          status: GameSessionStatusEnum.ENDED,
          startedAt: new Date('2026-01-01'),
          endedAt: new Date('2026-01-01'),
        },
      ];
      mockSessionRepo.findAndCount.mockResolvedValue([sessions, 1]);

      const countBuilder = makeQueryBuilderMock();
      countBuilder.getRawMany.mockResolvedValue([]);
      const topScorerBuilder = makeQueryBuilderMock();
      topScorerBuilder.getRawMany.mockResolvedValue([]);
      mockParticipantRepo.createQueryBuilder
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(topScorerBuilder);

      const result = await service.listGameSessions('game-1', 1, 20);

      expect(result.data).toEqual([
        expect.objectContaining({
          sessionCode: 'GAME-EMPTY1',
          participantCount: 0,
          topScore: null,
          topScorerName: null,
        }),
      ]);
    });

    it('returns an empty page without querying aggregates when the game has no sessions', async () => {
      mockGameRepo.findOne.mockResolvedValue({ id: 'game-1' });
      mockSessionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.listGameSessions('game-1', 1, 20);

      expect(result.data).toEqual([]);
      expect(mockParticipantRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('getMyGameHistory', () => {
    it('returns rank, participant count, and answer stats for a past session', async () => {
      const pageBuilder = makeQueryBuilderMock();
      pageBuilder.getManyAndCount.mockResolvedValue([
        [
          {
            id: 'part-1',
            totalScore: 1500,
            session: {
              id: 'sess-1',
              sessionCode: 'GAME-ABC123',
              startedAt: new Date('2026-01-01'),
              game: { title: 'Bible Trivia' },
            },
          },
        ],
        1,
      ]);
      mockParticipantRepo.createQueryBuilder.mockReturnValueOnce(pageBuilder);
      mockParticipantRepo.query.mockResolvedValue([
        { session_id: 'sess-1', rank: '1', participant_count: '4' },
      ]);
      const responseBuilder = makeQueryBuilderMock();
      responseBuilder.getRawMany.mockResolvedValue([
        { participantId: 'part-1', answered: 5, correct: 4 },
      ]);
      mockResponseRepo.createQueryBuilder.mockReturnValueOnce(responseBuilder);

      const result = await service.getMyGameHistory('member-1', 1, 10);

      expect(result.data).toEqual([
        expect.objectContaining({
          sessionCode: 'GAME-ABC123',
          gameTitle: 'Bible Trivia',
          totalScore: 1500,
          rank: 1,
          participantCount: 4,
          correctCount: 4,
          answeredCount: 5,
        }),
      ]);
    });

    it('gives tied scores the same rank, not a split ranking', async () => {
      const pageBuilder = makeQueryBuilderMock();
      pageBuilder.getManyAndCount.mockResolvedValue([
        [
          {
            id: 'part-1',
            totalScore: 1000,
            session: {
              id: 'sess-1',
              sessionCode: 'GAME-TIE0001',
              startedAt: new Date('2026-01-01'),
              game: { title: 'Bible Trivia' },
            },
          },
        ],
        1,
      ]);
      mockParticipantRepo.createQueryBuilder.mockReturnValueOnce(pageBuilder);
      // Two members tied at the top — both rank 1 (RANK(), not ROW_NUMBER()),
      // this member's own row is what the outer query filters back to.
      mockParticipantRepo.query.mockResolvedValue([
        { session_id: 'sess-1', rank: '1', participant_count: '2' },
      ]);
      const responseBuilder = makeQueryBuilderMock();
      responseBuilder.getRawMany.mockResolvedValue([]);
      mockResponseRepo.createQueryBuilder.mockReturnValueOnce(responseBuilder);

      const result = await service.getMyGameHistory('member-1', 1, 10);

      expect(result.data[0]).toEqual(
        expect.objectContaining({ rank: 1, participantCount: 2 }),
      );
    });

    it('returns an empty page, not a throw, for a member with no game history', async () => {
      const pageBuilder = makeQueryBuilderMock();
      pageBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      mockParticipantRepo.createQueryBuilder.mockReturnValueOnce(pageBuilder);

      const result = await service.getMyGameHistory('member-1', 1, 10);

      expect(result.data).toEqual([]);
      expect(mockParticipantRepo.query).not.toHaveBeenCalled();
    });
  });
});
