import { useContext } from "react";
import { UserContext } from "../contexts/authContext";

export function useAuth() {
    const context = useContext(UserContext);

    if (!context) {
        console.log("userAuth must be used within authProvider hook");
    }
    return context;
}
