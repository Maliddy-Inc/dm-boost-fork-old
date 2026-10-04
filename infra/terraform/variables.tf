variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "worker_name" {
  description = "Worker name (must match `name` in cloudflare/wrangler.jsonc)"
  type        = string
  default     = "dm-boost"
}

variable "custom_domain" {
  description = "Optional custom hostname for the Worker (e.g. dm-boost.example.com). Empty = workers.dev only"
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "Zone ID of custom_domain (required when custom_domain is set)"
  type        = string
  default     = ""
}
