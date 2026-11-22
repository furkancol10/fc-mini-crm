export type UserRole = 'admin' | 'staff';
export type UserSpecialty = 'service' | 'agency' | 'all';

export interface AuthUser {
	id: number;
	name: string;
	role: UserRole;
	specialty: UserSpecialty;
}
