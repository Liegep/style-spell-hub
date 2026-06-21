// Love Potion Blogger Delivery Server
// Put this script inside an in-world object, then add the deliverable product
// objects/folders to the same object's inventory.
//
// In Content Studio, set delivery_item_key to the exact inventory item name.
// Example: Holiday Magic Gown - Blogger Pack

string SHARED_SECRET = "CHANGE_ME_TO_MATCH_SECOND_LIFE_DELIVERY_SECRET";
string SUPABASE_REGISTER_URL = "https://dvhrisqlybqsrzsfoyfx.supabase.co/functions/v1/register-delivery-server";
string deliveryUrl;
key registerRequestId;
integer lastRegisterAt;
integer REFRESH_SECONDS = 900;

integer requestDeliveryUrl()
{
    llRequestURL();
    return TRUE;
}

integer hasText(string value)
{
    return llStringLength(llStringTrim(value, STRING_TRIM)) > 0;
}

string jsonText(string body, list path)
{
    string value = llJsonGetValue(body, path);
    if (value == JSON_INVALID)
    {
        return "";
    }

    return llStringTrim(value, STRING_TRIM);
}

string buildNotificationMessage(string title, string message, string actionUrl, string imageUrl, string fallbackUrl)
{
    string text = "Love Potion HQ";

    if (hasText(title))
    {
        text += "\n" + title;
    }

    if (hasText(message))
    {
        text += "\n\n" + message;
    }

    if (hasText(imageUrl))
    {
        text += "\n\nImage: " + imageUrl;
    }
    else if (hasText(fallbackUrl))
    {
        text += "\n\nImage: " + fallbackUrl;
    }

    if (hasText(actionUrl) && actionUrl != imageUrl && actionUrl != fallbackUrl)
    {
        text += "\n\nOpen: " + actionUrl;
    }

    return text;
}

integer registerDeliveryUrl()
{
    if (!hasText(deliveryUrl))
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

    registerRequestId = llHTTPRequest(
        SUPABASE_REGISTER_URL,
        [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"],
        payload
    );
    lastRegisterAt = llGetUnixTime();

    return TRUE;
}

integer startDeliveryServer()
{
    llSetTimerEvent((float)REFRESH_SECONDS);
    requestDeliveryUrl();
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
        if (change & (CHANGED_REGION | CHANGED_REGION_START | CHANGED_OWNER | CHANGED_INVENTORY))
        {
            startDeliveryServer();
        }
    }

    timer()
    {
        if (!hasText(deliveryUrl))
        {
            requestDeliveryUrl();
            return;
        }

        if (llGetUnixTime() - lastRegisterAt >= REFRESH_SECONDS)
        {
            registerDeliveryUrl();
        }
    }

    http_request(key requestId, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            deliveryUrl = body;
            llOwnerSay("Delivery server URL ready: " + deliveryUrl);
            registerDeliveryUrl();
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

        string secret = jsonText(body, ["secret"]);
        if (secret != SHARED_SECRET)
        {
            llHTTPResponse(requestId, 403, "Invalid delivery secret.");
            return;
        }

        string mode = jsonText(body, ["mode"]);
        if (!hasText(mode))
        {
            mode = "delivery";
        }

        string avatarUuid = jsonText(body, ["avatar_uuid"]);

        if (mode == "notify")
        {
            string notificationTitle = jsonText(body, ["title"]);
            string notificationBody = jsonText(body, ["body"]);
            string actionUrl = jsonText(body, ["action_url"]);
            string imageUrl = jsonText(body, ["image_url"]);
            string fallbackUrl = jsonText(body, ["fallback_url"]);
            string textureItemName = jsonText(body, ["texture_item_name"]);

            if (!hasText(fallbackUrl))
            {
                fallbackUrl = actionUrl;
            }

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

            if (!hasText(avatarUuid) || (!hasText(notificationTitle) && !hasText(notificationBody) && !hasText(imageUrl) && !hasText(fallbackUrl)))
            {
                llHTTPResponse(requestId, 400, "Missing avatar_uuid or notification text.");
                return;
            }

            llInstantMessage((key)avatarUuid, buildNotificationMessage(notificationTitle, notificationBody, actionUrl, imageUrl, fallbackUrl));
            llHTTPResponse(requestId, 200, "Notification sent.");
            return;
        }

        if (mode != "delivery")
        {
            llHTTPResponse(requestId, 400, "Unknown mode: " + mode);
            return;
        }

        string itemName = jsonText(body, ["item_key"]);
        string productName = jsonText(body, ["product_name"]);

        if (!hasText(avatarUuid) || !hasText(itemName))
        {
            llHTTPResponse(requestId, 400, "Missing avatar_uuid or item_key.");
            return;
        }

        integer inventoryType = llGetInventoryType(itemName);
        if (inventoryType == INVENTORY_NONE)
        {
            llHTTPResponse(requestId, 404, "Inventory item not found: " + itemName);
            return;
        }

        llGiveInventory((key)avatarUuid, itemName);
        llHTTPResponse(requestId, 200, "Delivered " + productName + " using inventory item " + itemName + ".");
    }

    http_response(key requestId, integer status, list metadata, string body)
    {
        if (requestId == registerRequestId)
        {
            if (status >= 200 && status < 300)
            {
                llOwnerSay("Delivery URL registered with Love Potion HQ.");
            }
            else
            {
                llOwnerSay("Delivery URL registration failed (" + (string)status + "): " + body);
            }
        }
    }
}
