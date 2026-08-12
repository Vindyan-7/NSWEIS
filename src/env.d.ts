/// <reference path="../.astro/types.d.ts" />
import type { UserProfile } from './types/domain';

declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email?: string;
      } | null;
      profile: UserProfile | null;
    }
  }
}
