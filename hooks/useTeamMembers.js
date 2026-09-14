// Updated useTeamMembers.js - Backward compatible version

import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { team_info } from "../api/team_members";

const membersKey = (teamId) => `team_members_${teamId}`;
const selectedKey = (teamId) => `selected_team_member_${teamId}`;

export function useTeamMembers(teamId) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!teamId) {
      setTeamMembers([]);
      setSelectedMember(null);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const mKey = membersKey(teamId);
      const sKey = selectedKey(teamId);

      try {
        const [cachedMembers, cachedSelected] = await Promise.all([
          AsyncStorage.getItem(mKey),
          AsyncStorage.getItem(sKey),
        ]);

        if (cachedMembers && isMounted.current) {
          const parsed = JSON.parse(cachedMembers);
          setTeamMembers(parsed);
          setIsLoading(false);
        }

        if (cachedSelected && isMounted.current) {
          setSelectedMember(JSON.parse(cachedSelected));
        }
      } catch (e) {
        console.warn("[useTeamMembers] cache read failed:", e?.message);
      }

      try {
        const fresh = await team_info(teamId);
        if (!isMounted.current) return;

        // Transform team members to include role data while keeping backward compatibility
        const members = (fresh?.team_members ?? []).map((item) => {
          // Return an object that has both the user properties at root (for backward compatibility)
          // AND the role information nested (for new code)
          return {
            // Backward compatible fields (directly accessible)
            id: item.user.id,
            first_name: item.user.first_name,
            last_name: item.user.last_name,
            height: item.user.height,
            weight: item.user.weight,
            email: item.user.email,
            // New fields with role information
            role_id: item.role?.id,
            role_name: item.role?.name,
            team_id: item.team_id,
            access_type: item.access_type,
            // Keep original nested data for reference
            user: item.user,
            role: item.role,
          };
        });
        
        console.log("\n📋 TEAM MEMBERS (with role data):");
        members.forEach((member, idx) => {
          console.log(`Member ${idx + 1}: ${member.first_name} ${member.last_name}`);
          console.log(`  Role ID: ${member.role_id}`);
          console.log(`  Role Name: ${member.role_name}`);
        });

        setTeamMembers(members);
        setIsLoading(false);

        await AsyncStorage.setItem(mKey, JSON.stringify(members));

        const cachedSelected = await AsyncStorage.getItem(sKey);
        const parsedSelected = cachedSelected ? JSON.parse(cachedSelected) : null;

        if (parsedSelected) {
          const stillValid = members.some((m) => m.id === parsedSelected.id);
          if (stillValid) {
            setSelectedMember(parsedSelected);
          } else {
            setSelectedMember(null);
            await AsyncStorage.removeItem(sKey);
          }
        }
      } catch (e) {
        console.warn("[useTeamMembers] API fetch failed:", e?.message);
        if (isMounted.current) {
          setError(e);
          setIsLoading(false);
        }
      }
    };

    load();
  }, [teamId]);

  const selectMember = async (member) => {
    if (!teamId) return;
    setSelectedMember(member);
    await AsyncStorage.setItem(selectedKey(teamId), JSON.stringify(member));
  };

  const refresh = async () => {
    if (!teamId) return;
    setError(null);

    try {
      const fresh = await team_info(teamId);
      if (!isMounted.current) return;

      const members = (fresh?.team_members ?? []).map((item) => ({
        id: item.user.id,
        first_name: item.user.first_name,
        last_name: item.user.last_name,
        height: item.user.height,
        weight: item.user.weight,
        email: item.user.email,
        role_id: item.role?.id,
        role_name: item.role?.name,
        team_id: item.team_id,
        access_type: item.access_type,
        user: item.user,
        role: item.role,
      }));

      setTeamMembers(members);
      await AsyncStorage.setItem(membersKey(teamId), JSON.stringify(members));
    } catch (e) {
      console.warn("[useTeamMembers] refresh failed:", e?.message);
      if (isMounted.current) setError(e);
    }
  };

  return {
    teamMembers,
    selectedMember,
    setSelectedMember: selectMember,
    isLoading,
    error,
    refresh,
  };
}