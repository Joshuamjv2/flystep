import request from "../utils/network"

export const login = async (data) => await request ({
    method: "POST",
    url: "/auth/login",
    data: data
})

export const user_info = async ({ language = "en", refresh = false } = {}) =>
  await request({
    method: "GET",
    url: `/auth/app/me?language=${language}&refresh=${refresh}`,
  });

export const update_user_info = async (data) => await request({
    method: "PATCH",
    url: "/auth",
    data: data
})

export const update_athlete_info = async (data) => await request({
    method: "PATCH",
    url: `/auth?id=${data?.id}`,
    data: data
})

export const logout = async () => await request({
    method: "GET",
    url: "/auth/logout"
})


export const get_all_users = async () => await request({
    method: "GET",
    url: `/auth?user_type=admin`
})



export const me = async () => await request({
    method: "GET",
    url: "/auth/me"
})



export const request_password_reset = async (data) => await request({
    method: "POST",
    url: `/auth/password_reset_request`,
    data: data
})

export const reset_password = async (data, token) => await request({
    method: "POST",
    url: `/auth/password_reset_confirm?token=${token}`,
    data: data
})

export const create_account = async (data, token) => await request ({
        method: "POST",
        url: "/invites/register_invited_user",
        data: data,
        params: {token: token}
    })


export const change_password = async (data) => request({
    method: "PATCH",
    url: "/auth/change_password",
    data: data
})
