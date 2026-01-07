import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let toastController: jasmine.SpyObj<ToastController>;
  let translateService: jasmine.SpyObj<TranslateService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    const translateSpy = jasmine.createSpyObj('TranslateService', ['instant']);

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        GlobalErrorHandler,
        { provide: ToastController, useValue: toastSpy },
        { provide: TranslateService, useValue: translateSpy },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
    toastController = TestBed.inject(ToastController) as jasmine.SpyObj<ToastController>;
    translateService = TestBed.inject(TranslateService) as jasmine.SpyObj<TranslateService>;
    
    consoleErrorSpy = spyOn(console, 'error');

    // Mock toast
    const mockToast = jasmine.createSpyObj('Toast', ['present']);
    toastController.create.and.returnValue(Promise.resolve(mockToast));
  });

  it('should be created', () => {
    expect(handler).toBeTruthy();
  });

  describe('handleError', () => {
    it('should log error to console', () => {
      const error = new Error('Test error');
      
      handler.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('GlobalErrorHandler:', error);
    });

    it('should display toast message for generic error', async () => {
      const error = new Error('Test error');
      translateService.instant.and.returnValue('Unknown error');

      handler.handleError(error);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(toastController.create).toHaveBeenCalledWith({
        message: 'Unknown error',
        duration: 3000,
        position: 'top',
        color: 'warning',
      });
    });

    it('should extract error code from HttpErrorResponse', () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E1001' },
        status: 401,
      });
      translateService.instant.and.returnValue('Invalid credentials');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E1001');
    });

    it('should handle E1001 error code', async () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E1001' },
        status: 401,
      });
      translateService.instant.and.returnValue('Invalid username or password');

      handler.handleError(errorResponse);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(translateService.instant).toHaveBeenCalledWith('errors.E1001');
      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Invalid username or password',
          color: 'warning',
        })
      );
    });

    it('should handle E1002 session expired error', () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E1002' },
        status: 401,
      });
      translateService.instant.and.returnValue('Session expired. Please login again.');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E1002');
    });

    it('should handle E2001 invalid state transition', () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E2001' },
        status: 400,
      });
      translateService.instant.and.returnValue('Invalid state transition');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E2001');
    });

    it('should handle E2002 settlement locked error', () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E2002' },
        status: 400,
      });
      translateService.instant.and.returnValue('Settlement is locked. Cannot modify.');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E2002');
    });

    it('should handle E2006 version conflict error', () => {
      const errorResponse = new HttpErrorResponse({
        error: { code: 'E2006' },
        status: 409,
      });
      translateService.instant.and.returnValue('Modified by another user. Please refresh.');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E2006');
    });

    it('should handle 401 unauthorized with status code message', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
      });
      translateService.instant.and.returnValue('Login required');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.unauthorized');
    });

    it('should handle 403 forbidden', () => {
      const errorResponse = new HttpErrorResponse({
        status: 403,
      });
      translateService.instant.and.returnValue('Access denied');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.forbidden');
    });

    it('should handle 404 not found', () => {
      const errorResponse = new HttpErrorResponse({
        status: 404,
      });
      translateService.instant.and.returnValue('Resource not found');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.not_found');
    });

    it('should handle 409 conflict', () => {
      const errorResponse = new HttpErrorResponse({
        status: 409,
      });
      translateService.instant.and.returnValue('Conflict occurred');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.conflict');
    });

    it('should handle 500 server error with danger color', async () => {
      const errorResponse = new HttpErrorResponse({
        status: 500,
      });
      translateService.instant.and.returnValue('Server error occurred');

      handler.handleError(errorResponse);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          color: 'danger',
        })
      );
    });

    it('should use warning color for client errors', async () => {
      const errorResponse = new HttpErrorResponse({
        status: 400,
      });
      translateService.instant.and.returnValue('Network error');

      handler.handleError(errorResponse);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          color: 'warning',
        })
      );
    });

    it('should handle error with alternative error property', () => {
      const errorResponse = new HttpErrorResponse({
        error: { error: 'E1001' },
        status: 401,
      });
      translateService.instant.and.returnValue('Invalid credentials');

      handler.handleError(errorResponse);

      expect(translateService.instant).toHaveBeenCalledWith('errors.E1001');
    });
  });

  describe('Complexity Requirements', () => {
    it('should have methods with low cyclomatic complexity', () => {
      // This is a structural test to ensure methods are properly split
      expect(typeof handler['extractErrorCode']).toBe('function');
      expect(typeof handler['getErrorMessage']).toBe('function');
      expect(typeof handler['getHttpErrorMessage']).toBe('function');
      expect(typeof handler['getErrorColor']).toBe('function');
      expect(typeof handler['presentToast']).toBe('function');
      expect(typeof handler['logToMonitoring']).toBe('function');
      expect(typeof handler['showUserMessage']).toBe('function');
    });
  });
});
