export class AppError extends Error {
    constructor(
        public message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class GeminiError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 'GEMINI_API_ERROR', 503, details);
    }
}

export class SupabaseError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 'SUPABASE_ERROR', 500, details);
    }
}

export class ImageProcessError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 'IMAGE_PROCESS_ERROR', 422, details);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}
