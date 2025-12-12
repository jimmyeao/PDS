import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSocketGatewayService } from './websocket.gateway';
import { DevicesModule } from '../devices/devices.module';
import { ScreenshotsModule } from '../screenshots/screenshots.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    forwardRef(() => DevicesModule),
    forwardRef(() => ScreenshotsModule),
    forwardRef(() => SchedulesModule),
  ],
  providers: [WebSocketGatewayService],
  exports: [WebSocketGatewayService],
})
export class WebSocketModule {}
