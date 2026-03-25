import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[];
    let error: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception.name;
    } else if (typeof exceptionResponse === 'object') {
      const res = exceptionResponse as Record<string, unknown>;
      // Validation errors come as an array of messages
      message = (res.message as string | string[]) ?? exception.message;
      error = (res.error as string) ?? exception.name;
    } else {
      message = exception.message;
      error = exception.name;
    }

    const body = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.warn(
      `HTTP ${statusCode} ${request.method} ${request.url} - ${
        Array.isArray(message) ? message.join('; ') : message
      }`,
    );

    response.status(statusCode).json(body);
  }
}
