import request from "../utils/network";

export const get_single_device_type = (id) =>
    request({
        method: "GET",
        url: `/device_types/${id}`,
    });


export const get_device_types = () =>
    request({
        method: "GET",
        url: "/device_types/app",
    });
