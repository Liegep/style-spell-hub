export type AppRole = "blogger" | "admin" | "super_admin";
export type AccountStatus = "pending" | "active" | "blocked" | "left";
export type AvailabilityStatus = "available" | "vacation" | "busy" | "offline";
export type BloggerTier = "standard" | "friend";
export type ProductStatus = "draft" | "available" | "archived";
export type ClaimStatus = "claimed" | "delivered" | "failed";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_revision";
export type MessageScope = "personal" | "broadcast";
export type NotificationChannel = "in_app" | "second_life" | "email";
export type NotificationType =
  | "new_product"
  | "new_message"
  | "post_approved"
  | "post_rejected"
  | "needs_revision"
  | "deadline_soon"
  | "account_blocked"
  | "account_reactivated"
  | "manual";
export type NotificationStatus = "pending" | "sent" | "failed" | "cancelled";
export type ApplicationFieldType = "short_text" | "long_text" | "email" | "url" | "select" | "checkbox" | "date";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  sl_avatar_name: string | null;
  sl_legacy_name: string | null;
  sl_display_name: string | null;
  sl_avatar_uuid: string | null;
  avatar_url: string | null;
  role: AppRole;
  account_status: AccountStatus;
  availability_status: AvailabilityStatus;
  blogger_tier: BloggerTier;
  status_message: string | null;
  language_preference: "en" | "es";
  flickr_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  blog_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductRelease = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  short_description: string | null;
  long_description: string | null;
  handwritten_note: string | null;
  blogging_recommendations: string | null;
  editorial_image_url: string | null;
  image_url: string | null;
  vendor_poster_url: string | null;
  second_life_link: string | null;
  marketplace_link: string | null;
  release_date: string | null;
  deadline_at: string | null;
  status: ProductStatus;
  featured_on_landing: boolean;
  display_order: number;
  delivery_item_key: string | null;
  auto_archive_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductReleaseImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductClaim = {
  id: string;
  product_id: string;
  blogger_id: string;
  status: ClaimStatus;
  delivery_response: string | null;
  claimed_at: string;
  delivered_at: string | null;
};

export type BlogSubmission = {
  id: string;
  product_id: string;
  blogger_id: string;
  claim_id: string | null;
  status: SubmissionStatus;
  blogger_note: string | null;
  promotion_consent: boolean;
  reviewed_by: string | null;
  review_comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogSubmissionLink = {
  id: string;
  submission_id: string;
  platform: string;
  url: string;
  note: string | null;
  sort_order: number;
  created_at: string;
};

export type InternalMessage = {
  id: string;
  scope: MessageScope;
  sender_id: string | null;
  recipient_id: string | null;
  subject: string;
  body: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type BloggerApplication = {
  id: string;
  display_name: string;
  email: string;
  sl_avatar_name: string | null;
  sl_avatar_uuid: string | null;
  language_preference: "en" | "es";
  flickr_url: string | null;
  instagram_url: string | null;
  blog_url: string | null;
  answers: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  review_comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type ApplicationFormField = {
  id: string;
  field_key: string;
  label: string;
  field_type: ApplicationFieldType;
  placeholder: string | null;
  help_text: string | null;
  options: string[];
  required: boolean;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type NewsletterSubscriber = {
  id: string;
  email: string | null;
  display_name: string | null;
  sl_avatar_name: string | null;
  sl_avatar_uuid: string | null;
  language_preference: "en" | "es";
  source: string;
  is_active: boolean;
  notes: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterCampaign = {
  id: string;
  created_by: string | null;
  title: string;
  body: string;
  image_url: string | null;
  status: "draft" | "queued" | "sent";
  recipient_count: number;
  queued_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SharedResource = {
  id: string;
  kind: "link" | "image";
  title: string;
  url: string;
  description: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: AppRole | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NotificationQueue = {
  id: string;
  recipient_id: string | null;
  recipient_sl_uuid: string | null;
  delivery_server_url: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  last_error: string | null;
  read_at: string | null;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};
