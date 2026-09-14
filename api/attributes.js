import request from "../utils/network";

export const activity_attributes = async (sub_activity_id) =>
    await request({
        method: "GET",
        url: `/activity_attributes?sub_activity=${sub_activity_id}`,
    });
