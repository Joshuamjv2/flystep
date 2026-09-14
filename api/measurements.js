import request from "../utils/network";

export const create_measurement = async (data) =>
  await request({
    method: "POST",
    url: "/measurements",
    data: data,
  });

export const finish_measurement = async (data) =>
  await request({
    method: "POST",
    url: "/finish_measurements",
    data: data,
  });
