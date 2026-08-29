// Name this object "Love Potion Updates" and add these copyable/transferable
// notecards: "Love Potion Product Release" and "Love Potion New Message".
// It is automatically delivered for new_product and new_message notifications.

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
    string payload = "{}";
    list httpOptions = [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"];

    if (hasText(deliveryUrl) == FALSE)
    {
        return FALSE;
    }

    payload = llJsonSetValue(payload, ["secret"], SHARED_SECRET);
    payload = llJsonSetValue(payload, ["server_url"], deliveryUrl);
    payload = llJsonSetValue(payload, ["object_name"], llGetObjectName());
    payload = llJsonSetValue(payload, ["object_key"], (string)llGetKey());
    payload = llJsonSetValue(payload, ["region_name"], llGetRegionName());
    payload = llJsonSetValue(payload, ["owner_key"], (string)llGetOwner());

    registerRequestId = llHTTPRequest(
        SUPABASE_REGISTER_URL,
        httpOptions,
        payload
    );
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
        string avatarUuid;
        string mode;
        string actionUrl;
        string imageUrl;
        string fallbackUrl;
        string textureItemName;
        string notecardItemName;
        string itemName;
        string productName;

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

        avatarUuid = jsonText(body, "avatar_uuid");
        mode = jsonText(body, "mode");
        if (!hasText(mode)) mode = "delivery";

        if (mode == "notify")
        {
            actionUrl = jsonText(body, "action_url");
            imageUrl = jsonText(body, "image_url");
            fallbackUrl = jsonText(body, "fallback_url");
            textureItemName = jsonText(body, "texture_item_name");
            notecardItemName = jsonText(body, "notecard_item_name");
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

            if (hasText(notecardItemName))
            {
                if (llGetInventoryType(notecardItemName) == INVENTORY_NOTECARD)
                    llGiveInventory((key)avatarUuid, notecardItemName);
                else
                    llOwnerSay("Notification notecard missing or invalid: " + notecardItemName + ". Add a notecard with this exact name to the delivery box.");
            }

            llInstantMessage((key)avatarUuid, notificationText(jsonText(body, "title"), jsonText(body, "body"), actionUrl, imageUrl, fallbackUrl));
            llHTTPResponse(requestId, 200, "Notification sent and notecard delivery processed.");
            return;
        }

        itemName = jsonText(body, "item_key");
        productName = jsonText(body, "product_name");

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
