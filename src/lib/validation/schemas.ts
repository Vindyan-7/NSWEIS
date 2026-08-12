export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function validateLoginInput(formData: FormData): ValidationResult<{ email: string; password: string }> {
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();
  const errors: Record<string, string> = {};

  if (!email || !email.includes('@')) {
    errors.email = 'Valid email address is required';
  }
  if (!password || password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { email, password } };
}

export function validateInterventionInput(formData: FormData): ValidationResult<{
  title: string;
  description: string;
  category: string;
  scheduled_at: string;
  location: string;
  capacity?: number;
}> {
  const title = (formData.get('title') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const category = (formData.get('category') as string || '').trim();
  const scheduled_at = (formData.get('scheduled_at') as string || '').trim();
  const location = (formData.get('location') as string || '').trim();
  const capacityStr = formData.get('capacity') as string;
  const capacity = capacityStr ? parseInt(capacityStr, 10) : undefined;

  const errors: Record<string, string> = {};

  if (!title) errors.title = 'Title is required';
  if (!description) errors.description = 'Description is required';
  if (!category) errors.category = 'Wellness category is required';
  if (!scheduled_at) errors.scheduled_at = 'Schedule date & time is required';
  if (!location) errors.location = 'Location is required';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { title, description, category, scheduled_at, location, capacity },
  };
}
