string ENDPOINT = "https://dvhrisqlybqsrzsfoyfx.supabase.co/functions/v1/toggle-newsletter-subscriber";
string SECRET = "PASTE_YOUR_SECOND_LIFE_DELIVERY_SECRET_HERE";

key requestId;
key toucherId;

default
{
    state_entry()
    {
        llOwnerSay("Love Potion newsletter subscriber prim ready.");
    }

    touch_start(integer total_number)
    {
        toucherId = llDetectedKey(0);
        string avatarName = llDetectedName(0);

        if (SECRET == "" || SECRET == "PASTE_YOUR_SECOND_LIFE_DELIVERY_SECRET_HERE")
        {
            llOwnerSay("Newsletter secret is not configured in the script.");
            return;
        }

        string payload = llList2Json(JSON_OBJECT, [
            "secret", SECRET,
            "avatar_uuid", (string)toucherId,
            "avatar_name", avatarName
        ]);

        requestId = llHTTPRequest(
            ENDPOINT,
            [
                HTTP_METHOD, "POST",
                HTTP_MIMETYPE, "application/json",
                HTTP_BODY_MAXLENGTH, 4096
            ],
            payload
        );
    }

    http_response(key request_id, integer status, list metadata, string body)
    {
        if (request_id != requestId)
        {
            return;
        }

        if (status < 200 || status >= 300)
        {
            llInstantMessage(toucherId, "Love Potion newsletter is unavailable right now. Please try again later.");
            llOwnerSay("Newsletter toggle failed (" + (string)status + "): " + body);
            return;
        }

        string message = llJsonGetValue(body, ["message"]);
        if (message == JSON_INVALID || message == "")
        {
            message = "Love Potion newsletter updated.";
        }

        llInstantMessage(toucherId, message);
    }
}
