# Second Life delivery bridge

This Edge Function is called when a blogger clicks `Claim product`.

Required Supabase Edge Function secrets:

```bash
supabase secrets set SECOND_LIFE_DELIVERY_URL="https://your-second-life-cap-url"
supabase secrets set SECOND_LIFE_DELIVERY_SECRET="choose-a-long-shared-secret"
```

`SECOND_LIFE_DELIVERY_URL` is now only a fallback. The preferred flow is automatic:

1. Run `sql/2026-06-05-second-life-delivery-auto-register.sql` once.
2. Deploy both Edge Functions:

```bash
supabase functions deploy register-delivery-server --no-verify-jwt
supabase functions deploy deliver-product
```

3. Put the updated `second-life/love-potion-delivery-server.lsl` script in the delivery object.

Whenever the Second Life region or script restarts, the object requests a fresh capability URL and posts it to `register-delivery-server`. `deliver-product` uses the latest registered URL.

Deploy:

```bash
supabase functions deploy deliver-product
```

The Second Life delivery object should accept a JSON `POST` containing:

```json
{
  "mode": "delivery",
  "secret": "shared secret",
  "claim_id": "uuid",
  "product_id": "uuid",
  "product_name": "Product name",
  "item_key": "delivery item key from Content Studio",
  "avatar_uuid": "Second Life avatar uuid",
  "avatar_name": "Second Life avatar name",
  "display_name": "platform display name"
}
```

On success, return any `2xx` response. The response text is stored in `product_claims.delivery_response`.

For the included LSL script, `item_key` is treated as the exact inventory item name inside the delivery object.

The same in-world object also accepts notification posts:

```json
{
  "mode": "notify",
  "secret": "shared secret",
  "avatar_uuid": "Second Life avatar uuid",
  "title": "New message from Love Potion HQ",
  "body": "You have a new note waiting in your mailbox.",
  "action_url": "https://your-site.example/app/blogger?section=inbox",
  "image_url": "https://your-public-image-url.example/newsletter.png",
  "fallback_url": "https://your-public-image-url.example/newsletter.png"
}
```

For newsletter campaigns, `image_url` is the public uploaded image and `fallback_url`
is the link included in the IM if image delivery cannot be treated visually by the
Second Life viewer/object.
