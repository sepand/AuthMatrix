/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      sub: string;
      name?: string;
      email?: string;
      roles?: string[];
      permissions?: string[];
      iss?: string;
      aud?: string;
    };
  }
}
