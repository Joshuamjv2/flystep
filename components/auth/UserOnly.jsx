import { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "expo-router";
import ThemedLoader from "../ThemedLoader";

const UserOnly = ({ children }) => {
    const { user, authChecked } = useAuth()
    const router = useRouter()

    useEffect(()=>{
        if (authChecked && user === null) {
            router.replace("/login")
        }
    }, [user, authChecked])

    if (!authChecked || !user) {
        return (
            <ThemedLoader />
        )
    }

    return children
}

export default UserOnly;