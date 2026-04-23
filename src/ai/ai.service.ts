import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('AI_SERVICE_URL') ??
      'http://ai:8000';
  }

  /**
   * Call the AI service to predict diseases based on symptoms.
   */
  async predictDisease(symptoms: string[]): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/predict`, { symptoms }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `AI predict-disease call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'AI service is currently unavailable. Please try again later.',
      );
    }
  }

  /**
   * Call the AI service to check drug interactions.
   */
  async checkDrugInteractions(medications: string[]): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/interactions`, {
          medications,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `AI drug-interactions call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'AI service is currently unavailable. Please try again later.',
      );
    }
  }
}
