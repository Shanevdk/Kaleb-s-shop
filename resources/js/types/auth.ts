export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type UserRole = 'admin' | 'mechanic' | 'scheduler' | 'shopper';

export type RoleOption = {
    value: UserRole;
    label: string;
    description: string;
};

export type Auth = {
    user: User;
    role: UserRole;
    can: {
        manageTeam: boolean;
        workOnRecords: boolean;
        manageSchedule: boolean;
    };
};

export type TeamMember = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    role_label: string;
    is_verified: boolean;
    created_at: string | null;
    is_current_user: boolean;
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
