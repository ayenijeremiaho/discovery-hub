import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TenantTypeOrmModule } from '../tenant/utility/tenant-typeorm.module';
import { Game } from './entity/game.entity';
import { GameQuestion } from './entity/game-question.entity';
import { GameSession } from './entity/game-session.entity';
import { GameParticipant } from './entity/game-participant.entity';
import { GameResponse } from './entity/game-response.entity';
import { GameService } from './service/game.service';
import { GameSessionGateway } from './gateway/game-session.gateway';
import { AdminGameController } from './controller/admin-game.controller';
import { GameParticipantController } from './controller/game-participant.controller';
import { UtilityModule } from '../utility/utility.module';
import { Tenant } from '../tenant/entity/tenant.entity';
import jwtConfig from '../config/jwt.config';
import refreshJwtConfig from '../config/refresh.jwt.config';

@Module({
  imports: [
    TenantTypeOrmModule.forFeature([
      Game,
      GameQuestion,
      GameSession,
      GameParticipant,
      GameResponse,
    ]),
    // Independent registration from AuthModule's own (same jwtConfig/
    // refreshJwtConfig factories, same secrets) — GameSessionGateway
    // verifies a JWT's tenant claim itself in handleConnection, the same
    // pattern ServiceSessionGateway/ServiceProgrammeModule already use.
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(refreshJwtConfig),
    // Tenant is public-schema, control-plane — plain TypeOrmModule, needed
    // by the gateway's subdomain->schema lookup for unauthenticated
    // (projector-screen) socket connections.
    TypeOrmModule.forFeature([Tenant]),
    UtilityModule,
  ],
  providers: [GameService, GameSessionGateway],
  controllers: [AdminGameController, GameParticipantController],
})
export class GamesModule {}
