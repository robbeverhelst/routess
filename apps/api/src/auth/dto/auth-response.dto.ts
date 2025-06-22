export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: number;
    email: string;
    name: string;
    avatar?: string;
    isEmailVerified: boolean;
  };
}
