/**
 * Staff Profile — TypeScript interfaces
 * Covers all fields from the Staff Update Form, Medical Information Form,
 * and Guarantor's Form uploaded by Kalu.
 * Staff fills this form; HR reads all sections (including medical Tier-3).
 */

/* ── Shared enums ─────────────────────────────────────── */
export type BloodGroup = 'A+' | 'A−' | 'B+' | 'B−' | 'O+' | 'O−' | 'AB+' | 'AB−';
export type Genotype   = 'AA' | 'AS' | 'SS' | 'AC' | 'SC';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed';
export type Proficiency   = 'Very Good' | 'Good' | 'Fair';
export type FamilyRelation = 'Spouse' | 'Son' | 'Daughter' | 'Other';
export type NokRelation =
  | 'Spouse' | 'Parent' | 'Sibling' | 'Child' | 'Aunt / Uncle' | 'Friend' | 'Other';
export type ProfileState = 'not_started' | 'draft' | 'submitted' | 'verified';

/* ── Sub-objects ──────────────────────────────────────── */
export interface FamilyMember {
  full_name: string;
  date_of_birth: string;      // ISO date
  relationship: FamilyRelation;
}

export interface EducationEntry {
  institution_name: string;
  address: string;
  from_date: string;          // YYYY-MM
  to_date: string;            // YYYY-MM
  certificate_obtained: string;
}

export interface LanguageEntry {
  language: string;
  speaking: Proficiency;
  reading: Proficiency;
  writing: Proficiency;
}

export interface WorkEntry {
  organisation: string;
  from_date: string;          // YYYY-MM
  to_date: string;            // YYYY-MM or 'Present'
  responsibilities: string;
}

/** ─── TIER 1 · PUBLIC (profile-visible) ─────────────── */
export interface ProfileTier1 {
  // Name
  surname: string;
  first_name: string;
  middle_name?: string;
  // Identity
  date_of_birth: string;        // ISO date — day+month used for D6; full date HR-only display
  nationality: string;
  state_of_origin?: string;
  lga?: string;
  hometown?: string;
  // Contact (public-ish — phone/personal email go into Tier 2 in practice)
  phone?: string;
}

/** ─── TIER 2 · INTERNAL ────────────────────────────── */
export interface ProfileTier2 extends ProfileTier1 {
  personal_email?: string;
  home_address: string;
  religion?: string;
  // Nationality extras
  place_of_birth?: string;      // non-Nigerians
  country_of_birth?: string;
  // Marital
  marital_status: MaritalStatus;
  date_of_marriage?: string;
  spouse_name?: string;
  spouse_nationality?: string;
  spouse_profession?: string;
  family_members: FamilyMember[];
  // Next of kin
  nok_name: string;
  nok_relationship: NokRelation;
  nok_phone: string;
  nok_email?: string;
  nok_address: string;
  // Education
  secondary_school?: EducationEntry;
  tertiary_education: EducationEntry[];
  professional_qualifications: EducationEntry[];
  // Languages
  languages: LanguageEntry[];
  // Experience
  total_years_experience?: number;
  work_history: WorkEntry[];
  has_criminal_record: boolean;
  criminal_record_details?: string;
  // Guarantor (HR-visible, not public)
  guarantor_name: string;
  guarantor_relationship: string;
  guarantor_profession?: string;
  guarantor_company?: string;
  guarantor_office_address?: string;
  guarantor_phone: string;
  guarantor_email?: string;
  guarantor_comments?: string;
  guarantor_form_acknowledged: boolean;
  // Submission
  profile_state: ProfileState;
  submitted_at?: string;
  digital_signature?: string;
  signature_date?: string;
}

/** ─── TIER 3 · HR-CONFIDENTIAL ─────────────────────── */
export interface ProfileTier3 extends ProfileTier2 {
  blood_group?: BloodGroup;
  genotype?: Genotype;
  allergy_1?: string;
  allergy_2?: string;
  medical_conditions?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_address?: string;
}

/** The full record as HR sees it. */
export type StaffProfileFull = ProfileTier3;

/** The payload the API returns to staff (no Tier-3 fields except their own). */
export type StaffProfileSelf = ProfileTier3;   // staff see own Tier-3
export type StaffProfileAdmin = ProfileTier2;  // Admins see Tier 2
export type StaffProfilePublic = ProfileTier1; // Public / Tier 1 only

/** POST /api/people/me/profile — staff submits this. */
export type StaffProfileInput = Omit<ProfileTier3,
  'profile_state' | 'submitted_at'>;

/** Required field IDs per section — mirrors the HTML form. */
export const REQUIRED_BY_SECTION: Record<string, (keyof StaffProfileFull)[]> = {
  personal:    ['surname', 'first_name', 'date_of_birth', 'nationality', 'home_address', 'phone'],
  family:      ['nok_name', 'nok_relationship', 'nok_phone', 'nok_address'],
  medical:     ['blood_group', 'genotype', 'emergency_contact_name', 'emergency_contact_phone'],
  education:   [],
  languages:   [],
  experience:  [],
  guarantor:   ['guarantor_name', 'guarantor_relationship', 'guarantor_phone'],
  declaration: ['digital_signature'],
};
