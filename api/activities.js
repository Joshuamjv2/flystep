import request from "../utils/network";


export const get_single_device_activity = (activity_id, device_type_id) =>
    request({
        method: "GET",
        url: `/device_activities/?activity_id=${activity_id}&device_type_id=${device_type_id}/`,
});


export const get_device_activities = async (device_type_id, language="en") =>
    request({
        method: "GET",
        url: `/device_activities/app?device_type_id=${device_type_id}&language=${language}`,
    });
