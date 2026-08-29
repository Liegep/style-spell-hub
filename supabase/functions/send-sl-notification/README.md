# Second Life notifications

This Edge Function sends an instant-message style notification to a Second Life avatar through the registered Love Potion delivery object.

Required secrets:

```bash
npx supabase@latest secrets set SECOND_LIFE_DELIVERY_SECRET="same-secret-as-the-LSL-script"
```

Optional notecard name override:

```bash
npx supabase@latest secrets set SECOND_LIFE_ALERT_NOTECARD="Love Potion Update"
```

Add a copyable and transferable notecard with that exact name to the delivery object's inventory.
The default name is `Love Potion Update`. Notifications of type `new_product` and `new_message`
automatically ask the object to give this notecard to the recipient. The instant message is still
sent with the specific product or message details. If the notecard is missing, the object warns its
owner and uses the IM as the fallback.

The function uses the latest URL registered by `register-delivery-server`. `SECOND_LIFE_DELIVERY_URL` is only a fallback.

Deploy:

```bash
npx supabase@latest functions deploy send-sl-notification --project-ref dvhrisqlybqsrzsfoyfx
```

Example request:

```json
{
  "recipientId": "profile uuid",
  "type": "new_message",
  "title": "New message from Love Potion HQ",
  "body": "You have a new note waiting in your mailbox.",
  "actionUrl": "https://your-site.example/app/blogger?section=inbox",
  "imageUrl": "https://your-public-image-url.example/newsletter.png",
  "fallbackUrl": "https://your-public-image-url.example/newsletter.png"
}
```

Or process a queued notification:

```json
{
  "queueId": "notification_queue uuid"
}
```

Newsletter image delivery:

- `imageUrl` is sent to the Second Life delivery object as `image_url`.
- `fallbackUrl` is sent as `fallback_url` and is also appended to the IM body as `Image: ...` when a campaign has an image.
- If the Edge Function cannot reach the image before delivery, the prim still receives the fallback link so subscribers can open it manually.
