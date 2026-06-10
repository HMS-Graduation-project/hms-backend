import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

const PNEUMONIA_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
]);
const PNEUMONIA_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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

  // ──────────────────── Symptom / Drug (existing) ──────────────────────

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
   * Returns the AI service's symptom catalogue ({ id, label }) so the
   * frontend symptom checker submits canonical ids rather than display text.
   */
  async getSymptoms(): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/symptoms`),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `AI symptoms call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'AI service is currently unavailable. Please try again later.',
      );
    }
  }

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

  // ──────────────────── Pneumonia Detection ────────────────────────────

  async pneumoniaHealth(): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/api/v1/ai/pneumonia/health`,
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `AI pneumonia-health call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Pneumonia AI service is currently unavailable.',
      );
    }
  }

  /**
   * Validate uploaded chest X-ray file.
   */
  private validateXrayFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!PNEUMONIA_ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Use JPG or PNG.`,
      );
    }
    if (file.size > PNEUMONIA_MAX_SIZE) {
      throw new PayloadTooLargeException(
        `File too large (${Math.round(file.size / 1024)} KB). Max 10 MB.`,
      );
    }
  }

  /**
   * Forward X-ray file to FastAPI as multipart/form-data.
   */
  private buildFormData(file: Express.Multer.File): FormData {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    return form;
  }

  async pneumoniaPredict(file: Express.Multer.File): Promise<unknown> {
    this.validateXrayFile(file);
    try {
      const form = this.buildFormData(file);
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/ai/pneumonia/predict`,
          form,
          { headers: form.getHeaders(), maxContentLength: 15_000_000 },
        ),
      );
      return response.data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error;
      }
      this.logger.error(
        `AI pneumonia-predict call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Pneumonia AI service is currently unavailable. Please try again later.',
      );
    }
  }

  async pneumoniaEnsemble(
    file: Express.Multer.File,
    includeGradcam: boolean = false,
  ): Promise<unknown> {
    this.validateXrayFile(file);
    try {
      const form = this.buildFormData(file);
      form.append('includeGradcam', String(includeGradcam));
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/ai/pneumonia/ensemble`,
          form,
          {
            headers: form.getHeaders(),
            maxContentLength: 15_000_000,
            timeout: 120_000, // 3 models + optional Grad-CAM
          },
        ),
      );
      return response.data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error;
      }
      this.logger.error(
        `AI pneumonia-ensemble call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Pneumonia AI ensemble service is currently unavailable. Please try again later.',
      );
    }
  }

  async pneumoniaExplain(file: Express.Multer.File): Promise<unknown> {
    this.validateXrayFile(file);
    try {
      const form = this.buildFormData(file);
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/api/v1/ai/pneumonia/explain`,
          form,
          {
            headers: form.getHeaders(),
            maxContentLength: 15_000_000,
            timeout: 60_000, // Grad-CAM is slower
          },
        ),
      );
      return response.data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error;
      }
      this.logger.error(
        `AI pneumonia-explain call failed: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Pneumonia AI service is currently unavailable. Please try again later.',
      );
    }
  }
}
