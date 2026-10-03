output "worker_name" {
  value = cloudflare_worker.dm_boost.name
}

output "custom_domain" {
  value = var.custom_domain == "" ? null : "https://${var.custom_domain}"
}
