string SHARED_SECRET = "CHANGE_ME_TO_MATCH_SECOND_LIFE_DELIVERY_SECRET";
string SUPABASE_REGISTER_URL = "https://dvhrisqlybqsrzsfoyfx.supabase.co/functions/v1/register-delivery-server";

string deliveryUrl;
key registerRequestId;

integer REFRESH_SECONDS = 900;

integer hasText(string value)
{
    return llStringLength(llStringTrim(value, STRING_TRIM)) > 0;
}

string jsonText(string body, string field)
{
    string value = llJsonGetValue(body, [field]);
    if (value == JSON_INVALID)
    {
        return "";
    }
    return llStringTrim(value, STRING_TRIM);
}

string notificationText(string title, string message, string actionUrl, string imageUrl, string fallbackUrl)
{
    string text = "Love Potion HQ";
    integer hasImage = hasText(imageUrl);

    if (hasText(title))
    {
        text += "\n" + title;
    }

    if (hasText(message))
    {
        text += "\n\n" + message;
    }

    if (hasImage)
    {
        text += "\n\nImage: " + imageUrl;
    }

    if (hasImage == FALSE && hasText(fallbackUrl))
    {
        text += "\n\nImage: " + fallbackUrl;
    }

    if (hasText(actionUrl) && actionUrl != imageUrl && actionUrl != fallbackUrl)
    {
        text += "\n\nOpen: " + actionUrl;
    }

    return text;
}

integer registerUrl()
{
    if (hasText(deliveryUrl) == FALSE)
    {
        return FALSE;
    }

    string payload = llList2Json(JSON_OBJECT, [
        "secret", SHARED_SECRET,
        "server_url", deliveryUrl,
        "object_name", llGetObjectName(),
        "object_key", (string)llGetKey(),
        "region_name", llGetRegionName(),
        "owner_key", (string)llGetOwner()
    ]);

    registerRequestId = llHTTPRequest(SUPABASE_REGISTER_URL, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"], payload);
    return TRUE;
}

integer startDeliveryServer()
{
    llSetTimerEvent((float)REFRESH_SECONDS);
    llRequestURL();
    return TRUE;
}

default
{
    state_entry()
    {
        startDeliveryServer();
    }

    on_rez(integer startParam)
    {
        startDeliveryServer();
    }

    changed(integer change)
    {
        if ((change & (CHANGED_REGION | CHANGED_REGION_START | CHANGED_OWNER | CHANGED_INVENTORY)) != 0)
        {
            startDeliveryServer();
        }
    }

    timer()
    {
        integer hasUrl = hasText(deliveryUrl);

        if (hasUrl)
        {
            registerUrl();
        }

        if (hasUrl == FALSE)
        {
            llRequestURL();
        }
    }

    http_request(key requestId, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            deliveryUrl = body;
            llOwnerSay("Delivery server URL ready: " + deliveryUrl);
            registerUrl();
            return;
        }

        if (method == URL_REQUEST_DENIED)
        {
            llOwnerSay("Delivery server URL denied: " + body);
            return;
        }

        if (method != "POST")
        {
            llHTTPResponse(requestId, 405, "POST only.");
            return;
        }

        if (jsonText(body, "secret") != SHARED_SECRET)
        {
            llHTTPResponse(requestId, 403, "Invalid delivery secret.");
            return;
        }

        string avatarUuid = jsonText(body, "avatar_uuid");
        string mode = jsonText(body, "mode");
        if (!hasText(mode)) mode = "delivery";

        if (mode == "notify")
        {
            string actionUrl = jsonText(body, "action_url");
            string imageUrl = jsonText(body, "image_url");
            string fallbackUrl = jsonText(body, "fallback_url");
            string textureItemName = jsonText(body, "texture_item_name");
            if (!hasText(fallbackUrl)) fallbackUrl = actionUrl;

            if (hasText(textureItemName) && llGetInventoryType(textureItemName) != INVENTORY_NONE)
            {
                llGiveInventory((key)avatarUuid, textureItemName);
                imageUrl = "";
                fallbackUrl = "";
            }
            else if (hasText(textureItemName))
            {
                imageUrl = "";
            }

            llInstantMessage((key)avatarUuid, notificationText(jsonText(body, "title"), jsonText(body, "body"), actionUrl, imageUrl, fallbackUrl));
            llHTTPResponse(requestId, 200, "Notification sent.");
            return;
        }

        string itemName = jsonText(body, "item_key");
        string productName = jsonText(body, "product_name");

        if (!hasText(avatarUuid) || !hasText(itemName))
        {
            llHTTPResponse(requestId, 400, "Missing avatar_uuid or item_key.");
            return;
        }

        if (llGetInventoryType(itemName) == INVENTORY_NONE)
        {
            llHTTPResponse(requestId, 404, "Inventory item not found: " + itemName);
            return;
        }

        llGiveInventory((key)avatarUuid, itemName);
        llHTTPResponse(requestId, 200, "Delivered " + productName + ".");
    }

    http_response(key requestId, integer status, list metadata, string body)
    {
        if (requestId != registerRequestId) return;
        if (status >= 200 && status < 300) llOwnerSay("Delivery URL registered with Love Potion HQ.");
        else llOwnerSay("Delivery URL registration failed (" + (string)status + "): " + body);
    }
}
