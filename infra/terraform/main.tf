# The Worker itself is owned by Terraform. Code versions and the container
# image are deployed by Wrangler in CI (Terraform cannot build/push images).
resource "cloudflare_worker" "dm_boost" {
  account_id = var.account_id
  name       = var.worker_name

  observability = {
    enabled = true
  }

  subdomain = {
    enabled = true
  }
}

resource "cloudflare_workers_custom_domain" "dm_boost" {
  count = var.custom_domain == "" ? 0 : 1

  account_id = var.account_id
  hostname   = var.custom_domain
  service    = cloudflare_worker.dm_boost.name
  zone_id    = var.zone_id
}
