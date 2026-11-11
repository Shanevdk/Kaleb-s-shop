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

export type Permission =
    | 'manage-team'
    | 'mechanics-shop'
    | 'vehicles'
    | 'lookup'
    | 'diagnose'
    | 'job-queue'
    | 'service-log'
    | 'inspections'
    | 'schedule'
    | 'inventory'
    | 'shopping-list'
    | 'receiving'
    | 'equipment'
    | 'equipment-usa'
    | 'assistant';

export type RoleOption = {
    value: UserRole;
    label: string;
    description: string;
    default_permissions: Permission[];
};

export type PermissionOption = {
    value: Permission;
    label: string;
};

export type Auth = {
    user: User;
    role: UserRole;
    can: {
        manageTeam: boolean;
        mechanicsShop: boolean;
        vehicles: boolean;
        lookup: boolean;
        diagnose: boolean;
        jobQueue: boolean;
        serviceLog: boolean;
        inspections: boolean;
        schedule: boolean;
        inventory: boolean;
        shoppingList: boolean;
        receiving: boolean;
        equipment: boolean;
        equipmentUsa: boolean;
        assistant: boolean;
    };
};

export type TeamMember = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    role_label: string;
    permissions: Permission[];
    is_verified: boolean;
    created_at: string | null;
    is_current_user: boolean;
};

/** A problem or idea sent to the admins from the Feedback button. */
export type FeedbackItem = {
    id: string;
    message: string;
    page: string | null;
    sender: { name: string; email: string } | null;
    sent_at: string | null;
    sent_ago: string | null;
    is_resolved: boolean;
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
