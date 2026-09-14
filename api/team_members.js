import request from "../utils/network"


export const team_info = async (team_id, refresh = true) =>
    await request({
        method: "GET",
        url: `/team/${team_id}?refresh=${refresh}`
    });

