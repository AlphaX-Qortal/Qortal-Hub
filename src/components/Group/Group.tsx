import {
  Avatar,
  Box,
  ButtonBase,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatGroup } from "../Chat/ChatGroup";
import { CreateCommonSecret } from "../Chat/CreateCommonSecret";
import { base64ToUint8Array } from "../../qdn/encryption/group-encryption";
import { uint8ArrayToObject } from "../../backgroundFunctions/encryption";
import CampaignIcon from "@mui/icons-material/Campaign";
import { AddGroup } from "./AddGroup";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CreateIcon from "@mui/icons-material/Create";


import {
  AuthenticatedContainerInnerRight,
  CustomButton,
} from "../../App-styles";
import { Spacer } from "../../common/Spacer";
import { ManageMembers } from "./ManageMembers";
import MarkChatUnreadIcon from "@mui/icons-material/MarkChatUnread";
import {
  MyContext,
  clearAllQueues,
  getArbitraryEndpointReact,
  getBaseApiReact,
  isMobile,
  pauseAllQueues,
  resumeAllQueues,
} from "../../App";
import { ChatDirect } from "../Chat/ChatDirect";
import { CustomizedSnackbars } from "../Snackbar/Snackbar";
import { LoadingButton } from "@mui/lab";
import { LoadingSnackbar } from "../Snackbar/LoadingSnackbar";
import { GroupAnnouncements } from "../Chat/GroupAnnouncements";



import { GroupForum } from "../Chat/GroupForum";
import {
  executeEvent,
  subscribeToEvent,
  unsubscribeFromEvent,
} from "../../utils/events";
import { RequestQueueWithPromise } from "../../utils/queue/queue";
import { WebSocketActive } from "./WebsocketActive";
import { useMessageQueue } from "../../MessageQueueContext";
import { isExtMsg, isUpdateMsg } from "../../background";
import { ContextMenu } from "../ContextMenu";

import { ReturnIcon } from "../../assets/Icons/ReturnIcon";
import { ExitIcon } from "../../assets/Icons/ExitIcon";
import { HomeDesktop } from "./HomeDesktop";
import {  IconWrapper } from "../Desktop/DesktopFooter";
import { DesktopHeader } from "../Desktop/DesktopHeader";
import { AppsDesktop } from "../Apps/AppsDesktop";
import { AppsDevMode } from "../Apps/AppsDevMode";
import { DesktopSideBar } from "../DesktopSideBar";
import { HubsIcon } from "../../assets/Icons/HubsIcon";
import { MessagingIcon } from "../../assets/Icons/MessagingIcon";
import { formatEmailDate } from "./QMailMessages";
import { AdminSpace } from "../Chat/AdminSpace";
import { useSetRecoilState } from "recoil";
import { addressInfoControllerAtom, selectedGroupIdAtom } from "../../atoms/global";
import { sortArrayByTimestampAndGroupName } from "../../utils/time";

import LockIcon from '@mui/icons-material/Lock';
import NoEncryptionGmailerrorredIcon from '@mui/icons-material/NoEncryptionGmailerrorred';


export const getPublishesFromAdmins = async (admins: string[], groupId) => {
  const queryString = admins.map((name) => `name=${name}`).join("&");
  const url = `${getBaseApiReact()}${getArbitraryEndpointReact()}?mode=ALL&service=DOCUMENT_PRIVATE&identifier=symmetric-qchat-group-${
    groupId
  }&exactmatchnames=true&limit=0&reverse=true&${queryString}&prefix=true`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("network error");
  }
  const adminData = await response.json();

  const filterId = adminData.filter(
    (data: any) =>
      data.identifier === `symmetric-qchat-group-${groupId}`
  );
  if (filterId?.length === 0) {
    return false;
  }
  const sortedData = filterId.sort((a: any, b: any) => {
    // Get the most recent date for both a and b
    const dateA = a.updated ? new Date(a.updated) : new Date(a.created);
    const dateB = b.updated ? new Date(b.updated) : new Date(b.created);

    // Sort by most recent
    return dateB.getTime() - dateA.getTime();
  });


  return sortedData[0];
};
interface GroupProps {
  myAddress: string;
  isFocused: boolean;
  userInfo: any;
  balance: number;
}

const timeDifferenceForNotificationChats = 900000;

export const requestQueueMemberNames = new RequestQueueWithPromise(5);
export const requestQueueAdminMemberNames = new RequestQueueWithPromise(5);

// const audio = new Audio(chrome.runtime?.getURL("msg-not1.wav"));

export const getGroupAdminsAddress = async (groupNumber: number) => {
  // const validApi = await findUsableApi();

  const response = await fetch(
    `${getBaseApiReact()}/groups/members/${groupNumber}?limit=0&onlyAdmins=true`
  );
  const groupData = await response.json();
  let members: any = [];
  if (groupData && Array.isArray(groupData?.members)) {
    for (const member of groupData.members) {
      if (member.member) {
        members.push(member?.member);
      }
    }

    return members;
  }
};

export function validateSecretKey(obj) {
  // Check if the input is an object
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Iterate over each key in the object
  for (let key in obj) {
    // Ensure the key is a string representation of a positive integer
    if (!/^\d+$/.test(key)) {
      return false;
    }

    // Get the corresponding value for the key
    const value = obj[key];

    // Check that value is an object and not null
    if (typeof value !== "object" || value === null) {
      return false;
    }

    // Check for messageKey 
    if (!value.hasOwnProperty("messageKey")) {
      return false;
    }

    // Ensure messageKey and nonce are non-empty strings
    if (
      typeof value.messageKey !== "string" ||
      value.messageKey.trim() === ""
    ) {
      return false;
    }
  }

  // If all checks passed, return true
  return true;
}

export const getGroupMembers = async (groupNumber: number) => {
  // const validApi = await findUsableApi();

  const response = await fetch(
    `${getBaseApiReact()}/groups/members/${groupNumber}?limit=0`
  );
  const groupData = await response.json();
  return groupData;
};


export const decryptResource = async (data: string, fromQortalRequest) => {
  try {
    return new Promise((res, rej) => {
      window.sendMessage("decryptGroupEncryption", {
        data,
      })
        .then((response) => {
          if (!response?.error) {
            res(response);
            return;
          }
          if(fromQortalRequest){
            rej({error: response.error, message: response?.error});
          } else {
            rej(response.error);

          }
        })
        .catch((error) => {
          if(fromQortalRequest){
            rej({message: error.message || "An error occurred", error: error.message || "An error occurred"});
          } else {
            rej(error.message || "An error occurred",);
          }
        });
      
    });
  } catch (error) {}
};

export const addDataPublishesFunc = async (data: string, groupId, type) => {
  try {
    return new Promise((res, rej) => {
      window.sendMessage("addDataPublishes", {
        data,
        groupId,
        type,
      })
        .then((response) => {
          if (!response?.error) {
            res(response);
            return;
          }
          rej(response.error);
        })
        .catch((error) => {
          rej(error.message || "An error occurred");
        });
      
    });
  } catch (error) {}
};

export const getDataPublishesFunc = async (groupId, type) => {
  try {
    return new Promise((res, rej) => {
      window.sendMessage("getDataPublishes", {
        groupId,
        type,
      })
        .then((response) => {
          if (!response?.error) {
            res(response);
            return;
          }
          rej(response.error);
        })
        .catch((error) => {
          rej(error.message || "An error occurred");
        });
      
    });
  } catch (error) {}
};

export async function getNameInfo(address: string) {
  const response = await fetch(`${getBaseApiReact()}/names/address/` + address);
  const nameData = await response.json();

  if (nameData?.length > 0) {
    return nameData[0]?.name;
  } else {
    return "";
  }
}

export const getGroupAdmins = async (groupNumber: number) => {
  // const validApi = await findUsableApi();

  const response = await fetch(
    `${getBaseApiReact()}/groups/members/${groupNumber}?limit=0&onlyAdmins=true`
  );
  const groupData = await response.json();
  let members: any = [];
  let membersAddresses = [];
  let both = [];


  const getMemNames = groupData?.members?.map(async (member) => {
    if (member?.member) {
      const name = await requestQueueAdminMemberNames.enqueue(() => {
        return getNameInfo(member.member);
      });
      if (name) {
        members.push(name);
        both.push({ name, address: member.member });
      }
      membersAddresses.push(member.member);
    }

    return true;
  });
  await Promise.all(getMemNames);

  return { names: members, addresses: membersAddresses, both };
};

export const getNames = async (listOfMembers) => {
  // const validApi = await findUsableApi();

  let members: any = [];

  const getMemNames = listOfMembers.map(async (member) => {
    if (member.member) {
      const name = await requestQueueMemberNames.enqueue(() => {
        return getNameInfo(member.member);
      });
      if (name) {
        members.push({ ...member, name });
      } else {
        members.push({ ...member, name: "" });
      }
    }

    return true;
  });

  await Promise.all(getMemNames);

  return members;
};
export const getNamesForAdmins = async (admins) => {

  let members: any = [];

  const getMemNames = admins?.map(async (admin) => {
    if (admin) {
      const name = await requestQueueAdminMemberNames.enqueue(() => {
        return getNameInfo(admin);
      });
      if (name) {
        members.push({ address: admin, name });
      }
    }

    return true;
  });
  await Promise.all(getMemNames);

  return members;
};

function areKeysEqual(array1, array2) {
  // If lengths differ, the arrays cannot be equal
  if (array1?.length !== array2?.length) {
    return false;
  }

  // Sort both arrays and compare their elements
  const sortedArray1 = [...array1].sort();
  const sortedArray2 = [...array2].sort();

  return sortedArray1.every((key, index) => key === sortedArray2[index]);
}

export const Group = ({
  myAddress,
  isFocused,
  userInfo,
  balance,
  setIsOpenDrawerProfile,
  setDesktopViewMode,
  desktopViewMode
}: GroupProps) => {
  const [desktopSideView, setDesktopSideView] = useState('groups')

  const [secretKey, setSecretKey] = useState(null);
  const [secretKeyPublishDate, setSecretKeyPublishDate] = useState(null);
  const lastFetchedSecretKey = useRef(null);
  const [secretKeyDetails, setSecretKeyDetails] = useState(null);
  const [newEncryptionNotification, setNewEncryptionNotification] =
    useState(null);
  const [memberCountFromSecretKeyData, setMemberCountFromSecretKeyData] =
    useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedDirect, setSelectedDirect] = useState(null);
  const hasInitialized = useRef(false);
  const hasInitializedWebsocket = useRef(false);
  const [groups, setGroups] = useState([]);
  const [directs, setDirects] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminsWithNames, setAdminsWithNames] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupOwner, setGroupOwner] = useState(null);
  const [triedToFetchSecretKey, setTriedToFetchSecretKey] = useState(false);
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [isInitialGroups, setIsInitialGroups] = useState(false);
  const [openManageMembers, setOpenManageMembers] = useState(false);
  const { setMemberGroups,  rootHeight } = useContext(MyContext);
  const lastGroupNotification = useRef<null | number>(null);
  const [timestampEnterData, setTimestampEnterData] = useState({});
  const [chatMode, setChatMode] = useState("groups");
  const [newChat, setNewChat] = useState(false);
  const [openSnack, setOpenSnack] = React.useState(false);
  const [infoSnack, setInfoSnack] = React.useState(null);
  const [isLoadingNotifyAdmin, setIsLoadingNotifyAdmin] = React.useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = React.useState(true);
  const [isLoadingGroup, setIsLoadingGroup] = React.useState(false);
  const [firstSecretKeyInCreation, setFirstSecretKeyInCreation] =
    React.useState(false);
  const [groupSection, setGroupSection] = React.useState("home");
  const [groupAnnouncements, setGroupAnnouncements] = React.useState({});
  const [defaultThread, setDefaultThread] = React.useState(null);
  const [isOpenDrawer, setIsOpenDrawer] = React.useState(false);
  const [hideCommonKeyPopup, setHideCommonKeyPopup] = React.useState(false);
  const [isLoadingGroupMessage, setIsLoadingGroupMessage] = React.useState("");
  const [drawerMode, setDrawerMode] = React.useState("groups");
  const [mutedGroups, setMutedGroups] = useState([]);
  const [mobileViewMode, setMobileViewMode] = useState("home");
  const [mobileViewModeKeepOpen, setMobileViewModeKeepOpen] = useState("");
  const isFocusedRef = useRef(true);
  const timestampEnterDataRef = useRef({});
  const selectedGroupRef = useRef(null);
  const selectedDirectRef = useRef(null);
  const groupSectionRef = useRef(null);
  const checkGroupInterval = useRef(null);
  const isLoadingOpenSectionFromNotification = useRef(false);
  const setupGroupWebsocketInterval = useRef(null);
  const settimeoutForRefetchSecretKey = useRef(null);
  const { clearStatesMessageQueueProvider } = useMessageQueue();
  const initiatedGetMembers = useRef(false);
  const [groupChatTimestamps, setGroupChatTimestamps] = React.useState({});
  const [appsMode, setAppsMode] = useState('home')
  const [appsModeDev, setAppsModeDev] = useState('home')
  const [isOpenSideViewDirects, setIsOpenSideViewDirects] = useState(false)
  const [isOpenSideViewGroups, setIsOpenSideViewGroups] = useState(false)
  const [isForceShowCreationKeyPopup, setIsForceShowCreationKeyPopup] = useState(false)

  const [groupsProperties, setGroupsProperties] = useState({})
  const setUserInfoForLevels = useSetRecoilState(addressInfoControllerAtom);

  const isPrivate = useMemo(()=> {
    if(!selectedGroup?.groupId || !groupsProperties[selectedGroup?.groupId]) return null
    if(groupsProperties[selectedGroup?.groupId]?.isOpen === true) return false
    if(groupsProperties[selectedGroup?.groupId]?.isOpen === false) return true
    return null
  }, [selectedGroup])

  const setSelectedGroupId = useSetRecoilState(selectedGroupIdAtom)
  const toggleSideViewDirects = ()=> {
    if(isOpenSideViewGroups){
      setIsOpenSideViewGroups(false)
    }
    setIsOpenSideViewDirects((prev)=> !prev)
  }
  const toggleSideViewGroups = ()=> {
    if(isOpenSideViewDirects){
      setIsOpenSideViewDirects(false)
    }
    setIsOpenSideViewGroups((prev)=> !prev)
  }
  useEffect(()=> {
    timestampEnterDataRef.current = timestampEnterData
  }, [timestampEnterData])

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);
  useEffect(() => {
    groupSectionRef.current = groupSection;
  }, [groupSection]);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
    setSelectedGroupId(selectedGroup?.groupId)
  }, [selectedGroup]);

  useEffect(() => {
    selectedDirectRef.current = selectedDirect;
  }, [selectedDirect]);



  const getUserSettings = async () => {
    try {
      return new Promise((res, rej) => {
        window.sendMessage("getUserSettings", {
          key: "mutedGroups",
        })
          .then((response) => {
            if (!response?.error) {
              setMutedGroups(response || []);
              res(response);
              return;
            }
            rej(response.error);
          })
          .catch((error) => {
            rej(error.message || "An error occurred");
          });
        
      });
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    getUserSettings();
  }, []);

  const getTimestampEnterChat = async () => {
    try {
      return new Promise((res, rej) => {
        window.sendMessage("getTimestampEnterChat")
  .then((response) => {
    if (!response?.error) {
      setTimestampEnterData(response);
      res(response);
      return;
    }
    rej(response.error);
  })
  .catch((error) => {
    rej(error.message || "An error occurred");
  });

      });
    } catch (error) {}
  };

  const refreshHomeDataFunc = () => {
    setGroupSection("default");
    setTimeout(() => {
      setGroupSection("home");
    }, 300);
  };

  const getGroupAnnouncements = async () => {
    try {
      return new Promise((res, rej) => {
        window.sendMessage("getGroupNotificationTimestamp")
        .then((response) => {
          if (!response?.error) {
            setGroupAnnouncements(response);
            res(response);
            return;
          }
          rej(response.error);
        })
        .catch((error) => {
          rej(error.message || "An error occurred");
        });
      
      });
    } catch (error) {}
  };

  useEffect(()=> {
    if(myAddress){
      getGroupAnnouncements()
      getTimestampEnterChat()
    }
  }, [myAddress])

  const getGroupOwner = async (groupId) => {
    try {
      const url = `${getBaseApiReact()}/groups/${groupId}`;
      const response = await fetch(url);
      let data = await response.json();

      const name = await getNameInfo(data?.owner);
      if (name) {
        data.name = name;
      }
      setGroupOwner(data);
    } catch (error) {}
  };




  const directChatHasUnread = useMemo(() => {
    let hasUnread = false;
    directs.forEach((direct) => {
      if (
        direct?.sender !== myAddress &&
        direct?.timestamp &&
        ((!timestampEnterData[direct?.address] &&
          Date.now() - direct?.timestamp <
            timeDifferenceForNotificationChats) ||
          timestampEnterData[direct?.address] < direct?.timestamp)
      ) {
        hasUnread = true;
      }
    });
    return hasUnread;
  }, [timestampEnterData, directs, myAddress]);

  const groupChatHasUnread = useMemo(() => {
    let hasUnread = false;
    groups.forEach((group) => {
     

      if (
        group?.data &&
        group?.sender !== myAddress &&
        group?.timestamp && groupChatTimestamps[group?.groupId] &&
        ((!timestampEnterData[group?.groupId]  &&
          Date.now() - group?.timestamp < timeDifferenceForNotificationChats) ||
          timestampEnterData[group?.groupId] < group?.timestamp)
      ) {
        hasUnread = true;
      }
    });
    return hasUnread;
  }, [timestampEnterData, groups, myAddress, groupChatTimestamps]);

  const groupsAnnHasUnread = useMemo(() => {
    let hasUnread = false;
    groups.forEach((group) => {
      if (
        groupAnnouncements[group?.groupId] &&
        !groupAnnouncements[group?.groupId]?.seentimestamp
      ) {
        hasUnread = true;
      }
    });
    return hasUnread;
  }, [groupAnnouncements, groups]);



  
  const getSecretKey = async (
    loadingGroupParam?: boolean,
    secretKeyToPublish?: boolean
  ) => {
    try {
      setIsLoadingGroupMessage("Locating encryption keys");
      pauseAllQueues();
      let dataFromStorage;
      let publishFromStorage;
      let adminsFromStorage;
      if (
        secretKeyToPublish &&
        secretKey &&
        lastFetchedSecretKey.current 
        &&
        Date.now() - lastFetchedSecretKey.current < 600000
      )
        return secretKey;
      if (loadingGroupParam) {
        setIsLoadingGroup(true);
      }
      if (selectedGroup?.groupId !== selectedGroupRef.current.groupId) {
        if (settimeoutForRefetchSecretKey.current) {
          clearTimeout(settimeoutForRefetchSecretKey.current);
        }
        return;
      }
      const prevGroupId = selectedGroupRef.current.groupId;
      // const validApi = await findUsableApi();
      const { names, addresses, both } =
        adminsFromStorage || (await getGroupAdmins(selectedGroup?.groupId));
      setAdmins(addresses);
      setAdminsWithNames(both);
      if (!names.length) {
        throw new Error("Network error");
      }
      const publish =
        publishFromStorage || (await getPublishesFromAdmins(names, selectedGroup?.groupId));

      if (prevGroupId !== selectedGroupRef.current.groupId) {
        if (settimeoutForRefetchSecretKey.current) {
          clearTimeout(settimeoutForRefetchSecretKey.current);
        }
        return;
      }
      if (publish === false) {
        setTriedToFetchSecretKey(true);
        settimeoutForRefetchSecretKey.current = setTimeout(() => {
          getSecretKey();
        }, 120000);
        return false;
      }
      setSecretKeyPublishDate(publish?.updated || publish?.created);
      let data;
      if (dataFromStorage) {
        data = dataFromStorage;
      } else {
        setIsLoadingGroupMessage("Downloading encryption keys");
        const res = await fetch(
          `${getBaseApiReact()}/arbitrary/DOCUMENT_PRIVATE/${publish.name}/${
            publish.identifier
          }?encoding=base64`
        );
        data = await res.text();
      }
      const decryptedKey: any = await decryptResource(data);
      const dataint8Array = base64ToUint8Array(decryptedKey.data);
      const decryptedKeyToObject = uint8ArrayToObject(dataint8Array);
      if (!validateSecretKey(decryptedKeyToObject))
        throw new Error("SecretKey is not valid");
      setSecretKeyDetails(publish);
      setSecretKey(decryptedKeyToObject);
      lastFetchedSecretKey.current = Date.now();
      setMemberCountFromSecretKeyData(decryptedKey.count);
      window.sendMessage("setGroupData", {
        groupId: selectedGroup?.groupId,
        secretKeyData: data,
        secretKeyResource: publish,
        admins: { names, addresses, both },
      }).catch((error) => {
          console.error("Failed to set group data:", error.message || "An error occurred");
        });
      
      if (decryptedKeyToObject) {
        setTriedToFetchSecretKey(true);
        setFirstSecretKeyInCreation(false);
        return decryptedKeyToObject;
      } else {
        setTriedToFetchSecretKey(true);
      }
    } catch (error) {
      if (error === "Unable to decrypt data") {
        setTriedToFetchSecretKey(true);
        settimeoutForRefetchSecretKey.current = setTimeout(() => {
          getSecretKey();
        }, 120000);
      }
    } finally {
      setIsLoadingGroup(false);
      setIsLoadingGroupMessage("");
      resumeAllQueues();
    }
  };


  const getAdminsForPublic = async(selectedGroup)=> {
    try {
      const { names, addresses, both } =
      await getGroupAdmins(selectedGroup?.groupId)
    setAdmins(addresses);
    setAdminsWithNames(both);
    } catch (error) {
      //error
    }
  }

  useEffect(() => {
    if (selectedGroup && isPrivate !== null) {
      if(isPrivate){
        setTriedToFetchSecretKey(false);
        getSecretKey(true);
      }
      
      getGroupOwner(selectedGroup?.groupId);
    }
    if(isPrivate === false){
      setTriedToFetchSecretKey(true);
      getAdminsForPublic(selectedGroup)

    }
  }, [selectedGroup, isPrivate]);

 



  const getCountNewMesg = async (groupId, after)=> {
    try {
      const response = await fetch(
        `${getBaseApiReact()}/chat/messages?after=${after}&txGroupId=${groupId}&haschatreference=false&encoding=BASE64&limit=1`
      );
      const data = await response.json();
      if(data && data[0]) return data[0].timestamp
    } catch (error) {
      
    }
  }

  const getLatestRegularChat = async (groups)=> {
    try {
      
      const groupData = {}

     const getGroupData = groups.map(async(group)=> {
        if(!group.groupId || !group?.timestamp) return null
        if((!groupData[group.groupId] || groupData[group.groupId] < group.timestamp)){
          const hasMoreRecentMsg = await getCountNewMesg(group.groupId, timestampEnterDataRef.current[group?.groupId] || Date.now() - 24 * 60 * 60 * 1000)
          if(hasMoreRecentMsg){
            groupData[group.groupId] = hasMoreRecentMsg
          }
        } else {
          return null
        }
      })

      await Promise.all(getGroupData)
      setGroupChatTimestamps(groupData)
    } catch (error) {
      
    }
  }

  const getGroupsProperties = useCallback(async(address)=> {
    try {
      const url = `${getBaseApiReact()}/groups/member/${address}`;
      const response = await fetch(url);
      if(!response.ok) throw new Error('Cannot get group properties')
      let data = await response.json();
    const transformToObject = data.reduce((result, item) => {
     
      result[item.groupId] = item
      return result;
    }, {});
      setGroupsProperties(transformToObject)
    } catch (error) {
      // error
    }
  }, [])


  useEffect(()=> {
    if(!myAddress) return
    if(areKeysEqual(groups?.map((grp)=> grp?.groupId), Object.keys(groupsProperties))){
    } else {
      getGroupsProperties(myAddress)
    }
  }, [groups, myAddress])

 

  useEffect(() => {
    // Handler function for incoming messages
    const messageHandler = (event) => {
      if (event.origin !== window.location.origin) {
        return;  
      }
      const message = event.data;
      if (message?.action === "SET_GROUPS") {

        // Update the component state with the received 'sendqort' state
        setGroups(sortArrayByTimestampAndGroupName(message.payload));
        getLatestRegularChat(message.payload);
        setMemberGroups(message.payload);
  
        if (selectedGroupRef.current && groupSectionRef.current === "chat") {
          window.sendMessage("addTimestampEnterChat", {
            timestamp: Date.now(),
            groupId: selectedGroupRef.current.groupId,
          }).catch((error) => {
            console.error("Failed to add timestamp:", error.message || "An error occurred");
          });
        }
  
        if (selectedDirectRef.current) {
          window.sendMessage("addTimestampEnterChat", {
            timestamp: Date.now(),
            groupId: selectedDirectRef.current.address,
          }).catch((error) => {
            console.error("Failed to add timestamp:", error.message || "An error occurred");
          });
        }
  
        setTimeout(() => {
          getTimestampEnterChat();
        }, 600);
      }
  
      if (message?.action === "SET_GROUP_ANNOUNCEMENTS") {
        // Update the component state with the received 'sendqort' state
        setGroupAnnouncements(message.payload);
  
        if (selectedGroupRef.current && groupSectionRef.current === "announcement") {
          window.sendMessage("addGroupNotificationTimestamp", {
            timestamp: Date.now(),
            groupId: selectedGroupRef.current.groupId,
          }).catch((error) => {
            console.error("Failed to add group notification timestamp:", error.message || "An error occurred");
          });
  
          setTimeout(() => {
            getGroupAnnouncements();
          }, 200);
        }
      }
  
      if (message?.action === "SET_DIRECTS") {
        // Update the component state with the received 'sendqort' state
        setDirects(message.payload);
      } else if (message?.action === "PLAY_NOTIFICATION_SOUND") {
        // audio.play();
      }
    };
  
    // Attach the event listener
    window.addEventListener("message", messageHandler);
  
    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);
  

  useEffect(() => {
    if (
      !myAddress ||
      hasInitializedWebsocket.current ||
      !groups ||
      groups?.length === 0
    )
      return;

      window.sendMessage("setupGroupWebsocket", {})
      .catch((error) => {
        console.error("Failed to setup group websocket:", error.message || "An error occurred");
      });
    

    hasInitializedWebsocket.current = true;
  }, [myAddress, groups]);

  const getMembers = async (groupId) => {
    try {
      const res = await getGroupMembers(groupId);
      if (groupId !== selectedGroupRef.current?.groupId) return;
      setMembers(res);
    } catch (error) {}
  };
  useEffect(() => {
    if (
      !initiatedGetMembers.current &&
      selectedGroup?.groupId &&
      secretKey &&
      admins.includes(myAddress)
    ) {
      // getAdmins(selectedGroup?.groupId);
      getMembers(selectedGroup?.groupId);
      initiatedGetMembers.current = true;
    }
  }, [selectedGroup?.groupId, secretKey, myAddress, admins]);

  const shouldReEncrypt = useMemo(() => {
    if (triedToFetchSecretKey && !secretKeyPublishDate) return true;
    if (
      !secretKeyPublishDate ||
      !memberCountFromSecretKeyData ||
      members?.length === 0
    )
      return false;
    const isDiffMemberNumber =
      memberCountFromSecretKeyData !== members?.memberCount &&
      newEncryptionNotification?.decryptedData?.data?.numberOfMembers !==
        members?.memberCount;

    if (isDiffMemberNumber) return true;

    const latestJoined = members?.members.reduce((maxJoined, current) => {
      return current.joined > maxJoined ? current.joined : maxJoined;
    }, members?.members[0].joined);

    if (
      secretKeyPublishDate < latestJoined &&
      newEncryptionNotification?.data?.timestamp < latestJoined
    ) {
      return true;
    }
    return false;
  }, [
    memberCountFromSecretKeyData,
    members,
    secretKeyPublishDate,
    newEncryptionNotification,
    triedToFetchSecretKey,
  ]);

  const notifyAdmin = async (admin) => {
    try {
      setIsLoadingNotifyAdmin(true);
      await new Promise((res, rej) => {
        window.sendMessage("notifyAdminRegenerateSecretKey", {
          adminAddress: admin.address,
          groupName: selectedGroup?.groupName,
        })
          .then((response) => {
            if (!response?.error) {
              res(response);
              return;
            }
            rej(response.error);
          })
          .catch((error) => {
            rej(error.message || "An error occurred");
          });
        
      });
      setInfoSnack({
        type: "success",
        message: "Successfully sent notification.",
      });
      setOpenSnack(true);
    } catch (error) {
      setInfoSnack({
        type: "error",
        message: "Unable to send notification",
      });
    } finally {
      setIsLoadingNotifyAdmin(false);
    }
  };

  const isUnreadChat = useMemo(() => {
    const findGroup = groups
      .filter((group) => group?.sender !== myAddress)
      .find((gr) => gr?.groupId === selectedGroup?.groupId);
    if (!findGroup) return false;
    if (!findGroup?.data) return false;
    return (
      findGroup?.timestamp && groupChatTimestamps[findGroup?.groupId] &&
      ((!timestampEnterData[selectedGroup?.groupId] &&
        Date.now() - findGroup?.timestamp <
          timeDifferenceForNotificationChats) ||
        timestampEnterData?.[selectedGroup?.groupId] < findGroup?.timestamp)
    );
  }, [timestampEnterData, selectedGroup, groupChatTimestamps]);

  const isUnread = useMemo(() => {
    if (!selectedGroup) return false;
    return (
      groupAnnouncements?.[selectedGroup?.groupId]?.seentimestamp === false
    );
  }, [groupAnnouncements, selectedGroup, myAddress]);

  const openDirectChatFromNotification = (e) => {
    if (isLoadingOpenSectionFromNotification.current) return;
    isLoadingOpenSectionFromNotification.current = true;
    const directAddress = e.detail?.from;

    const findDirect = directs?.find(
      (direct) => direct?.address === directAddress
    );
    if (findDirect?.address === selectedDirect?.address) {
      isLoadingOpenSectionFromNotification.current = false;
      return;
    }
    if (findDirect) {
      if(!isMobile){
        setDesktopSideView("directs");
        setDesktopViewMode('home')
      } else {
        setMobileViewModeKeepOpen("messaging");
      }
      setSelectedDirect(null);

      setNewChat(false);

      window.sendMessage("addTimestampEnterChat", {
        timestamp: Date.now(),
        groupId: findDirect.address,
      }).catch((error) => {
          console.error("Failed to add timestamp:", error.message || "An error occurred");
        });
      

      setTimeout(() => {
        setSelectedDirect(findDirect);
        getTimestampEnterChat();
        isLoadingOpenSectionFromNotification.current = false;
      }, 200);
    } else {
      isLoadingOpenSectionFromNotification.current = false;
    }
  };

  const openDirectChatFromInternal = (e) => {
    const directAddress = e.detail?.address;
    const name = e.detail?.name;
    const findDirect = directs?.find(
      (direct) => direct?.address === directAddress || direct?.name === name
    );

    if (findDirect) {
      if(!isMobile){
        setDesktopSideView("directs");
      } else {
        setMobileViewModeKeepOpen("messaging");
      }
      setSelectedDirect(null);

      setNewChat(false);

      window.sendMessage("addTimestampEnterChat", {
        timestamp: Date.now(),
        groupId: findDirect.address,
      }).catch((error) => {
          console.error("Failed to add timestamp:", error.message || "An error occurred");
        });
      

      setTimeout(() => {
        setSelectedDirect(findDirect);
        getTimestampEnterChat();
      }, 200);
    } else {
      if(!isMobile){
        setDesktopSideView("directs");
      } else {
        setMobileViewModeKeepOpen("messaging");
      }
      setNewChat(true);
      setTimeout(() => {
        executeEvent("setDirectToValueNewChat", {
          directToValue: name || directAddress,
        });
      }, 500);
    }
  };

  useEffect(() => {
    subscribeToEvent("openDirectMessageInternal", openDirectChatFromInternal);

    return () => {
      unsubscribeFromEvent(
        "openDirectMessageInternal",
        openDirectChatFromInternal
      );
    };
  }, [directs, selectedDirect]);

  useEffect(() => {
    subscribeToEvent("openDirectMessage", openDirectChatFromNotification);

    return () => {
      unsubscribeFromEvent("openDirectMessage", openDirectChatFromNotification);
    };
  }, [directs, selectedDirect]);

  const handleMarkAsRead = (e) => {
    const { groupId } = e.detail;
    window.sendMessage("addTimestampEnterChat", {
      timestamp: Date.now(),
      groupId,
    }).catch((error) => {
        console.error("Failed to add timestamp:", error.message || "An error occurred");
      });
    

      window.sendMessage("addGroupNotificationTimestamp", {
        timestamp: Date.now(),
        groupId,
      }).catch((error) => {
          console.error("Failed to add group notification timestamp:", error.message || "An error occurred");
        });
      
    setTimeout(() => {
      getGroupAnnouncements();
      getTimestampEnterChat();
    }, 200);
  };

  useEffect(() => {
    subscribeToEvent("markAsRead", handleMarkAsRead);

    return () => {
      unsubscribeFromEvent("markAsRead", handleMarkAsRead);
    };
  }, []);

  const resetAllStatesAndRefs = () => {
    // Reset all useState values to their initial states
    setSecretKey(null);
    lastFetchedSecretKey.current = null;
    setSecretKeyPublishDate(null);
    setSecretKeyDetails(null);
    setNewEncryptionNotification(null);
    setMemberCountFromSecretKeyData(null);
    setIsForceShowCreationKeyPopup(false)
    setSelectedGroup(null);
    setSelectedDirect(null);
    setGroups([]);
    setDirects([]);
    setAdmins([]);
    setAdminsWithNames([]);
    setMembers([]);
    setGroupOwner(null);
    setTriedToFetchSecretKey(false);
    setHideCommonKeyPopup(false);
    setOpenAddGroup(false);
    setIsInitialGroups(false);
    setOpenManageMembers(false);
    setMemberGroups([]); // Assuming you're clearing the context here as well
    setTimestampEnterData({});
    setChatMode("groups");
    setNewChat(false);
    setOpenSnack(false);
    setInfoSnack(null);
    setIsLoadingNotifyAdmin(false);
    setIsLoadingGroups(false);
    setIsLoadingGroup(false);
    setFirstSecretKeyInCreation(false);
    setGroupSection("home");
    setGroupAnnouncements({});
    setDefaultThread(null);
    setMobileViewMode("home");
    // Reset all useRef values to their initial states
    hasInitialized.current = false;
    hasInitializedWebsocket.current = false;
    lastGroupNotification.current = null;
    isFocusedRef.current = true;
    selectedGroupRef.current = null;
    selectedDirectRef.current = null;
    groupSectionRef.current = null;
    checkGroupInterval.current = null;
    isLoadingOpenSectionFromNotification.current = false;
    setupGroupWebsocketInterval.current = null;
    settimeoutForRefetchSecretKey.current = null;
    initiatedGetMembers.current = false;
    if(!isMobile){
      setDesktopViewMode('home')
    }
  };

  const logoutEventFunc = () => {
    resetAllStatesAndRefs();
    clearStatesMessageQueueProvider();
  };

  useEffect(() => {
    subscribeToEvent("logout-event", logoutEventFunc);

    return () => {
      unsubscribeFromEvent("logout-event", logoutEventFunc);
    };
  }, []);

  const openAppsMode = () => {
    if (isMobile) {
      setMobileViewMode("apps");
    }
    if (!isMobile) {
      setDesktopViewMode('apps')

    }
    if(isMobile){
      setIsOpenSideViewDirects(false)
      setIsOpenSideViewGroups(false)
      setGroupSection("default");
      setSelectedGroup(null);
      setNewChat(false);
      setSelectedDirect(null);
      setSecretKey(null);
      setGroupOwner(null)
      lastFetchedSecretKey.current = null;
      initiatedGetMembers.current = false;
      setSecretKeyPublishDate(null);
      setAdmins([]);
      setSecretKeyDetails(null);
      setAdminsWithNames([]);
      setMembers([]);
      setMemberCountFromSecretKeyData(null);
      setTriedToFetchSecretKey(false);
      setFirstSecretKeyInCreation(false);
      setIsOpenSideViewDirects(false)
      setIsOpenSideViewGroups(false)
    }
   

  };

  useEffect(() => {
    subscribeToEvent("open-apps-mode", openAppsMode);

    return () => {
      unsubscribeFromEvent("open-apps-mode", openAppsMode);
    };
  }, []);


 
  const openGroupChatFromNotification = (e) => {
    if (isLoadingOpenSectionFromNotification.current) return;

    const groupId = e.detail?.from;

    const findGroup = groups?.find((group) => +group?.groupId === +groupId);
    if (findGroup?.groupId === selectedGroup?.groupId) {
      isLoadingOpenSectionFromNotification.current = false;

      return;
    }
    if (findGroup) {
      setChatMode("groups");
      setSelectedGroup(null);
      setSelectedDirect(null);

      setNewChat(false);
      setSecretKey(null);
      setGroupOwner(null)
      lastFetchedSecretKey.current = null;
      initiatedGetMembers.current = false;
      setSecretKeyPublishDate(null);
      setAdmins([]);
      setSecretKeyDetails(null);
      setAdminsWithNames([]);
      setMembers([]);
      setMemberCountFromSecretKeyData(null);
      setIsForceShowCreationKeyPopup(false)
      setTriedToFetchSecretKey(false);
      setFirstSecretKeyInCreation(false);
      setGroupSection("chat");
      if(!isMobile){
        setDesktopViewMode('chat')
      }

      window.sendMessage("addTimestampEnterChat", {
        timestamp: Date.now(),
        groupId: findGroup.groupId,
      }).catch((error) => {
          console.error("Failed to add timestamp:", error.message || "An error occurred");
        });
      

      setTimeout(() => {
        setSelectedGroup(findGroup);
        setMobileViewMode("group");
        setDesktopSideView('groups')
        getTimestampEnterChat();
        isLoadingOpenSectionFromNotification.current = false;
      }, 350);
    } else {
      isLoadingOpenSectionFromNotification.current = false;
    }
  };

  useEffect(() => {
    subscribeToEvent("openGroupMessage", openGroupChatFromNotification);

    return () => {
      unsubscribeFromEvent("openGroupMessage", openGroupChatFromNotification);
    };
  }, [groups, selectedGroup]);

  const openGroupAnnouncementFromNotification = (e) => {
    const groupId = e.detail?.from;

    const findGroup = groups?.find((group) => +group?.groupId === +groupId);
    if (findGroup?.groupId === selectedGroup?.groupId) return;
    if (findGroup) {
      setChatMode("groups");
      setSelectedGroup(null);
      setSecretKey(null);
      setGroupOwner(null)
      lastFetchedSecretKey.current = null;
      initiatedGetMembers.current = false;
      setSecretKeyPublishDate(null);
      setAdmins([]);
      setSecretKeyDetails(null);
      setAdminsWithNames([]);
      setMembers([]);
      setMemberCountFromSecretKeyData(null);
      setIsForceShowCreationKeyPopup(false)
      setTriedToFetchSecretKey(false);
      setFirstSecretKeyInCreation(false);
      setGroupSection("announcement");
      if(!isMobile){
        setDesktopViewMode('chat')
      }
      window.sendMessage("addGroupNotificationTimestamp", {
        timestamp: Date.now(),
        groupId: findGroup.groupId,
      }).catch((error) => {
          console.error("Failed to add group notification timestamp:", error.message || "An error occurred");
        });
      
      setTimeout(() => {
        setSelectedGroup(findGroup);
        setMobileViewMode("group");
        setDesktopSideView('groups')
        getGroupAnnouncements();
      }, 350);
    }
  };

  useEffect(() => {
    subscribeToEvent(
      "openGroupAnnouncement",
      openGroupAnnouncementFromNotification
    );

    return () => {
      unsubscribeFromEvent(
        "openGroupAnnouncement",
        openGroupAnnouncementFromNotification
      );
    };
  }, [groups, selectedGroup]);

  const openThreadNewPostFunc = (e) => {
    const data = e.detail?.data;
    const { groupId } = data;
    const findGroup = groups?.find((group) => +group?.groupId === +groupId);
    if (findGroup?.groupId === selectedGroup?.groupId) {
      setGroupSection("forum");
      setDefaultThread(data);

      return;
    }
    if (findGroup) {
      setChatMode("groups");
      setSelectedGroup(null);
      setSecretKey(null);
      setGroupOwner(null)
      lastFetchedSecretKey.current = null;
      initiatedGetMembers.current = false;
      setSecretKeyPublishDate(null);
      setAdmins([]);
      setSecretKeyDetails(null);
      setAdminsWithNames([]);
      setMembers([]);
      setMemberCountFromSecretKeyData(null);
      setIsForceShowCreationKeyPopup(false)
      setTriedToFetchSecretKey(false);
      setFirstSecretKeyInCreation(false);
      setGroupSection("forum");
      setDefaultThread(data);
      if(!isMobile){
        setDesktopViewMode('chat')
      }
      setTimeout(() => {
        setSelectedGroup(findGroup);
        setMobileViewMode("group");
        setDesktopSideView('groups')
        getGroupAnnouncements();
      }, 350);
    }
  };

  useEffect(() => {
    subscribeToEvent("openThreadNewPost", openThreadNewPostFunc);

    return () => {
      unsubscribeFromEvent("openThreadNewPost", openThreadNewPostFunc);
    };
  }, [groups, selectedGroup]);

  const handleSecretKeyCreationInProgress = () => {
    setFirstSecretKeyInCreation(true);
  };

  const goToHome = async () => {
    if (isMobile) {
      setMobileViewMode("home");
    }
    if (!isMobile) {
    }
    setDesktopViewMode('home')


    await new Promise((res) => {
      setTimeout(() => {
        res(null);
      }, 200);
    });

  };

  const goToAnnouncements = async () => {
    setGroupSection("default");
    await new Promise((res) => {
      setTimeout(() => {
        res(null);
      }, 200);
    });
    setSelectedDirect(null);
    setNewChat(false);
    setGroupSection("announcement");
    window.sendMessage("addGroupNotificationTimestamp", {
      timestamp: Date.now(),
      groupId: selectedGroupRef.current.groupId,
    }).catch((error) => {
        console.error("Failed to add group notification timestamp:", error.message || "An error occurred");
      });
    
    setTimeout(() => {
      getGroupAnnouncements();
    }, 200);
  };

  const openDrawerGroups = () => {
    setIsOpenDrawer(true);
    setDrawerMode("groups");
  };

  const goToThreads = () => {
    setSelectedDirect(null);
    setNewChat(false);
    setGroupSection("forum");
  };

  const goToChat = async () => {
    setGroupSection("default");
    await new Promise((res) => {
      setTimeout(() => {
        res(null);
      }, 200);
    });
    setGroupSection("chat");
    setNewChat(false);
    setSelectedDirect(null);
    if (selectedGroupRef.current) {
      window.sendMessage("addTimestampEnterChat", {
        timestamp: Date.now(),
        groupId: selectedGroupRef.current.groupId,
      }).catch((error) => {
          console.error("Failed to add timestamp:", error.message || "An error occurred");
        });
      

      setTimeout(() => {
        getTimestampEnterChat();
      }, 200);
    }
  };



  const renderDirects = () => {
    return (
      <div
        style={{
          display: "flex",
          width: isMobile ? "100%" : "380px",
          flexDirection: "column",
          alignItems: "flex-start",
          height: isMobile ? `calc(${rootHeight} - 45px)` : "100%",
          background: !isMobile && 'var(--bg-primary)',
          borderRadius: !isMobile && '0px 15px 15px 0px'
        }}
      >
        {!isMobile && (
            <Box sx={{
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              display: 'flex',
              gap: '10px'
            }}>
               <ButtonBase
              onClick={() => {
                setDesktopSideView("groups");
              }}
            >
              <IconWrapper
                color={(groupChatHasUnread ||
                  groupsAnnHasUnread)
                         ? "var(--unread)"
                         : desktopSideView === 'groups' ? 'white' :"rgba(250, 250, 250, 0.5)"}
                label="Groups"
                selected={desktopSideView === 'groups'}
                customWidth="75px"
              >
                <HubsIcon
                  height={24}
                  color={
                    (groupChatHasUnread ||
               groupsAnnHasUnread)
                      ? "var(--unread)"
                      : desktopSideView === 'groups'
                      ? "white"
                      : "rgba(250, 250, 250, 0.5)"
                  }
                />
              </IconWrapper>
            </ButtonBase>
            <ButtonBase
              onClick={() => {
                setDesktopSideView("directs");
              }}
            >
              <IconWrapper
              customWidth="75px"
                color={directChatHasUnread ? "var(--unread)" : desktopSideView === 'directs' ? 'white' :"rgba(250, 250, 250, 0.5)"}
                label="Messaging"
                selected={desktopSideView === 'directs'}
              >
                <MessagingIcon
                  height={24}
                  color={
                    directChatHasUnread
                      ? "var(--unread)"
                      : desktopSideView === 'directs'
                      ? "white"
                      : "rgba(250, 250, 250, 0.5)"
                  }
                />
              </IconWrapper>
              </ButtonBase>
            </Box>
        )}
       
        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            alignItems: "flex-start",
            flexGrow: 1,
            overflowY: "auto",
          }}
        >
          {directs.map((direct: any) => (
            <List
              sx={{
                width: "100%",
              }}
              className="group-list"
              dense={true}
            >
              <ListItem
                onClick={() => {
                  setSelectedDirect(null);
                  setNewChat(false);
                  setIsOpenDrawer(false);
                  window.sendMessage("addTimestampEnterChat", {
                    timestamp: Date.now(),
                    groupId: direct.address,
                  }).catch((error) => {
                      console.error("Failed to add timestamp:", error.message || "An error occurred");
                    });
                  
                  setTimeout(() => {
                    setSelectedDirect(direct);

                    getTimestampEnterChat();
                  }, 200);
                }}
                sx={{
                  display: "flex",
                  width: "100%",
                  flexDirection: "column",
                  cursor: "pointer",
                  border: "1px #232428 solid",
                  padding: "2px",
                  borderRadius: "2px",
                  background:
                    direct?.address === selectedDirect?.address && "white",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        background: "#232428",
                        color: "white",
                      }}
                      alt={direct?.name || direct?.address}
                    >
                      {(direct?.name || direct?.address)?.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={direct?.name || direct?.address}
                    secondary={!direct?.timestamp ? 'no messages' :`last message: ${formatEmailDate(direct?.timestamp)}`}
                    primaryTypographyProps={{
                      style: {
                        color:
                          direct?.address === selectedDirect?.address &&
                          "black",
                        textWrap: "wrap",
                        overflow: "hidden",
                      },
                    }} // Change the color of the primary text
                    secondaryTypographyProps={{
                      style: {
                        color:
                          direct?.address === selectedDirect?.address &&
                          "black",
                          fontSize: '12px'
                      },
                    }}
                    sx={{
                      width: "150px",
                      fontFamily: "Inter",
                      fontSize: "16px",
                    }}
                  />
                  {direct?.sender !== myAddress &&
                    direct?.timestamp &&
                    ((!timestampEnterData[direct?.address] &&
                      Date.now() - direct?.timestamp <
                        timeDifferenceForNotificationChats) ||
                      timestampEnterData[direct?.address] <
                        direct?.timestamp) && (
                      <MarkChatUnreadIcon
                        sx={{
                          color: "var(--unread)",
                        }}
                      />
                    )}
                </Box>
              </ListItem>
            </List>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "center",
            padding: "10px",
          }}
        >
          <CustomButton
            onClick={() => {
              setNewChat(true);
              setSelectedDirect(null);
              setIsOpenDrawer(false);
            }}
          >
            <CreateIcon
              sx={{
                color: "white",
              }}
            />
            New Chat
          </CustomButton>
        </div>
      </div>
    );
  };


  const renderGroups = () => {
    return (
      <div
        style={{
          display: "flex",
          width: isMobile ? "100%" : "380px",
          flexDirection: "column",
          alignItems: "flex-start",
          height: isMobile ? `calc(${rootHeight} - 45px)` : "100%",
          background: !isMobile && 'var(--bg-primary)',
          borderRadius: !isMobile && '0px 15px 15px 0px'
        }}
      >
        {!isMobile && (
           <Box sx={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
            gap: '10px'
          }}>
             <ButtonBase
            onClick={() => {
              setDesktopSideView("groups");
            }}
          >
            <IconWrapper
              color={(groupChatHasUnread ||
                groupsAnnHasUnread)
                       ? "var(--unread)"
                       :  desktopSideView === 'groups' ? 'white' :"rgba(250, 250, 250, 0.5)"}
              label="Groups"
              selected={desktopSideView === 'groups'}
              customWidth="75px"
            >
              <HubsIcon
                height={24}
                color={
                  (groupChatHasUnread ||
             groupsAnnHasUnread)
                    ? "var(--unread)"
                    : desktopSideView === 'groups' 
                    ? "white"
                    : "rgba(250, 250, 250, 0.5)"
                }
              />
            </IconWrapper>
          </ButtonBase>
          <ButtonBase
            onClick={() => {
              setDesktopSideView("directs");
            }}
          >
            <IconWrapper
            customWidth="75px"
              color={directChatHasUnread ? "var(--unread)" : desktopSideView === 'directs' ? 'white' :"rgba(250, 250, 250, 0.5)"}
              label="Messaging"
              selected={desktopSideView === 'directs' }
            >
              <MessagingIcon
                height={24}
                color={
                  directChatHasUnread
                    ? "var(--unread)"
                    : desktopSideView === 'directs' 
                    ? "white"
                    : "rgba(250, 250, 250, 0.5)"
                }
              />
            </IconWrapper>
            </ButtonBase>
          </Box>
        )}
       
        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            alignItems: "flex-start",
            flexGrow: 1,
            overflowY: "auto",
            visibility: chatMode === "directs" && "hidden",
            position: chatMode === "directs" && "fixed",
            left: chatMode === "directs" && "-1000px",
          }}
        >
          {groups.map((group: any) => (
            <List
              sx={{
                width: "100%",
              }}
              className="group-list"
              dense={true}
            >
              <ListItem
                onClick={() => {
                  setMobileViewMode("group");
                  setDesktopSideView('groups')
                  initiatedGetMembers.current = false;
                  clearAllQueues();
                  setSelectedDirect(null);
                  setTriedToFetchSecretKey(false);
                  setNewChat(false);
                  setSelectedGroup(null);
                  setUserInfoForLevels({})
                  setSecretKey(null);
                  lastFetchedSecretKey.current = null;
                  setSecretKeyPublishDate(null);
                  setAdmins([]);
                  setSecretKeyDetails(null);
                  setAdminsWithNames([]);
                  setGroupOwner(null)
                  setMembers([]);
                  setMemberCountFromSecretKeyData(null);
                  setHideCommonKeyPopup(false);
                  setFirstSecretKeyInCreation(false);
                  setGroupSection("chat");
                  setIsOpenDrawer(false);
                  setIsForceShowCreationKeyPopup(false)
                  setTimeout(() => {
                    setSelectedGroup(group);

                  }, 200);
                }}
                sx={{
                  display: "flex",
                  width: "100%",
                  flexDirection: "column",
                  cursor: "pointer",
                  border: "1px #232428 solid",
                  padding: "2px",
                  borderRadius: "2px",
                  background:
                    group?.groupId === selectedGroup?.groupId && "white",
                }}
              >
                <ContextMenu
                  mutedGroups={mutedGroups}
                  getUserSettings={getUserSettings}
                  groupId={group.groupId}
                >
                  <Box
                    sx={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <ListItemAvatar>
                      {groupsProperties[group?.groupId]?.isOpen === false ? (
                        <Box sx={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: "#232428",
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                        <LockIcon sx={{
                          color: 'var(--green)'
                        }} />
                        </Box>
                      ): (
                        <Box sx={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: "#232428",
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                        <NoEncryptionGmailerrorredIcon sx={{
                          color: 'var(--danger)'
                        }} />
                        </Box>
                      //   <Avatar
                      //   sx={{
                      //     background: "#232428",
                      //     color: "white",
                      //   }}
                      //   alt={group?.groupName}
                      // >
                      //   {group.groupName?.charAt(0)}
                      // </Avatar>
                      )}
                      
                    </ListItemAvatar>
                    <ListItemText
                      primary={group.groupName}
                      secondary={!group?.timestamp ? 'no messages' :`last message: ${formatEmailDate(group?.timestamp)}`}
                      primaryTypographyProps={{
                        style: {
                          color:
                            group?.groupId === selectedGroup?.groupId &&
                            "black",
                        },
                      }} // Change the color of the primary text
                      secondaryTypographyProps={{
                        style: {
                          color:
                            group?.groupId === selectedGroup?.groupId &&
                            "black",
                            fontSize: '12px'
                        },
                      }}
                      sx={{
                        width: "150px",
                        fontFamily: "Inter",
                        fontSize: "16px",
                      }}
                    />
                    {groupAnnouncements[group?.groupId] &&
                      !groupAnnouncements[group?.groupId]?.seentimestamp && (
                        <CampaignIcon
                          sx={{
                            color: "var(--unread)",
                            marginRight: "5px",
                          }}
                        />
                      )}
                    {group?.data &&
                        groupChatTimestamps[group?.groupId] &&
                      group?.sender !== myAddress &&
                      group?.timestamp &&
                      ((!timestampEnterData[group?.groupId] &&
                        Date.now() - group?.timestamp <
                          timeDifferenceForNotificationChats) ||
                        timestampEnterData[group?.groupId] <
                          group?.timestamp) && (
                        <MarkChatUnreadIcon
                          sx={{
                            color: "var(--unread)",
                          }}
                        />
                      )}
                  </Box>
                </ContextMenu>
              </ListItem>
            </List>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "center",
            padding: "10px",
          }}
        >
          {chatMode === "groups" && (
            <CustomButton
              onClick={() => {
                setOpenAddGroup(true);
              }}
            >
              <AddCircleOutlineIcon
                sx={{
                  color: "white",
                }}
              />
              Group Mgmt
            </CustomButton>
          )}
          {chatMode === "directs" && (
            <CustomButton
              onClick={() => {
                setNewChat(true);
                setSelectedDirect(null);
                setIsOpenDrawer(false);
              }}
            >
              <CreateIcon
                sx={{
                  color: "white",
                }}
              />
              New Chat
            </CustomButton>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <>
      <WebSocketActive
        myAddress={myAddress}
        setIsLoadingGroups={setIsLoadingGroups}
      />
      <CustomizedSnackbars
        open={openSnack}
        setOpen={setOpenSnack}
        info={infoSnack}
        setInfo={setInfoSnack}
      />
      

     

      <div
        style={{
          display: "flex",
          width: "100%",
          height: isMobile ? "100%" : "100%",
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        {!isMobile && ((desktopViewMode !== 'apps' && desktopViewMode !== 'dev') || isOpenSideViewGroups) && (
             <DesktopSideBar desktopViewMode={desktopViewMode} toggleSideViewGroups={toggleSideViewGroups} toggleSideViewDirects={toggleSideViewDirects} goToHome={goToHome} mode={appsMode} setMode={setAppsMode} setDesktopSideView={setDesktopSideView} hasUnreadDirects={directChatHasUnread} isApps={desktopViewMode === 'apps'} myName={userInfo?.name}  isGroups={isOpenSideViewGroups}
             isDirects={isOpenSideViewDirects}    hasUnreadGroups={groupChatHasUnread ||
               groupsAnnHasUnread} setDesktopViewMode={setDesktopViewMode} />
        )}

        {!isMobile && desktopViewMode === 'chat' && desktopSideView !== 'directs' && renderGroups()}
        {!isMobile && desktopViewMode === 'chat'  && desktopSideView === 'directs' && renderDirects()}

        <Box
          sx={{
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <AddGroup
            address={myAddress}
            open={openAddGroup}
            setOpen={setOpenAddGroup}
          />


          {newChat && (
            <>
                {isMobile && (
                  <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    marginTop: "14px",
                    justifyContent: "center",
                    height: "15px",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "320px",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "50px",
                      }}
                    >
                      <ButtonBase
                        onClick={() => {
                          close()
                        }}
                      >
                        <ReturnIcon />
                      </ButtonBase>
                    </Box>
                   
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "50px",
                        justifyContent: "flex-end",
                      }}
                    >
                        <ButtonBase
                        onClick={() => {
                          setSelectedDirect(null)
                          setMobileViewModeKeepOpen('')
                        }}
                      >
                      <ExitIcon />
                      </ButtonBase>
                    </Box>
                  </Box>
                </Box>
                )}
              <Box
                sx={{
                  position: "absolute",
               
                  right: !(desktopViewMode === 'chat') ? "unset" :  "0px",
                  bottom: !(desktopViewMode === 'chat') ? "unset" :  "0px",
                  top: !(desktopViewMode === 'chat') ? "unset" :  "0px",
                  background: "#27282c",
                  zIndex: 5,
                  height: isMobile && `calc(${rootHeight} - 45px)`,
                  opacity: !(desktopViewMode === 'chat') ? 0 : 1,
                 
                left: !(desktopViewMode === 'chat') ? '-100000px' : '0px',
                      
                }}
              >
                <ChatDirect
                  myAddress={myAddress}
                  myName={userInfo?.name}
                  isNewChat={newChat}
                  selectedDirect={undefined}
                  setSelectedDirect={setSelectedDirect}
                  setNewChat={setNewChat}
                  getTimestampEnterChat={getTimestampEnterChat}
                  balance={balance}
                  close={() => {
                    setSelectedDirect(null);

                    setNewChat(false);
                  }}
                  setMobileViewModeKeepOpen={setMobileViewModeKeepOpen}
                />
              </Box>
            </>
          )}
          {desktopViewMode === 'chat' && !selectedGroup && (
            <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: 'center',
              height: '100%',
           
            }}
          >
            <Typography
              sx={{
                fontSize: "14px",
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.2)'
              }}
            >
              No group selected
            </Typography>
          </Box>
          )}

            <div style={{
              width: '100%',
              display: selectedGroup? 'block' : 'none',
              opacity: !(desktopViewMode === 'chat' && selectedGroup) ? 0 : 1,
      position: !(desktopViewMode === 'chat' && selectedGroup) ? 'absolute' : 'relative',
    left: !(desktopViewMode === 'chat' && selectedGroup) ? '-100000px' : '0px',
            }}>
            {!isMobile &&  (
        
        <DesktopHeader
        isPrivate={isPrivate}
        selectedGroup={selectedGroup}
        groupSection={groupSection}
        isUnread={isUnread}
        goToAnnouncements={goToAnnouncements}
        isUnreadChat={isUnreadChat}
        goToChat={goToChat}
        goToThreads={goToThreads}
        setOpenManageMembers={setOpenManageMembers}
        groupChatHasUnread={groupChatHasUnread}
        groupsAnnHasUnread={groupsAnnHasUnread}
        directChatHasUnread={directChatHasUnread}
        chatMode={chatMode}
        openDrawerGroups={openDrawerGroups}
        goToHome={goToHome}
        setIsOpenDrawerProfile={setIsOpenDrawerProfile}
        mobileViewMode={mobileViewMode}
        setMobileViewMode={setMobileViewMode}
        setMobileViewModeKeepOpen={setMobileViewModeKeepOpen}
        hasUnreadGroups={groupChatHasUnread ||
          groupsAnnHasUnread}
        hasUnreadDirects={directChatHasUnread}
        myName={userInfo?.name || null}
        isHome={groupSection === "home"}
        isGroups={desktopSideView === 'groups'}
        isDirects={desktopSideView === 'directs'}
        setDesktopSideView={setDesktopSideView}
        hasUnreadAnnouncements={isUnread}
        isAnnouncement={groupSection === "announcement"}
        isChat={groupSection === "chat"}
        hasUnreadChat={isUnreadChat}
        setGroupSection={setGroupSection}
        isForum={groupSection === "forum"}
        />
   
  )}
         
             
            
              <Box
                sx={{
                  position: "relative",
                  flexGrow: 1,
                  display: "flex",
                  // reference to change height
                  height: isMobile ? "calc(100% - 82px)" : "calc(100vh - 70px)",
                }}
              >
                {triedToFetchSecretKey && (
                  <ChatGroup
                    myAddress={myAddress}
                    selectedGroup={selectedGroup?.groupId}
                    getSecretKey={getSecretKey}
                    secretKey={secretKey}
                    isPrivate={isPrivate}
                    setSecretKey={setSecretKey}
                    handleNewEncryptionNotification={
                      setNewEncryptionNotification
                    }
                    hide={groupSection !== "chat" || selectedDirect || newChat}
                    hideView={!(desktopViewMode === 'chat' && selectedGroup)}
                    handleSecretKeyCreationInProgress={
                      handleSecretKeyCreationInProgress
                    }
                    triedToFetchSecretKey={triedToFetchSecretKey}
                    myName={userInfo?.name}
                    balance={balance}
                    getTimestampEnterChatParent={getTimestampEnterChat}
                  />
                )}
                {isPrivate && firstSecretKeyInCreation &&
                  triedToFetchSecretKey &&
                  !secretKeyPublishDate && (
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        padding: "20px",
                      }}
                    >
                      {" "}
                      <Typography>
                        The group's first common encryption key is in the
                        process of creation. Please wait a few minutes for it to
                        be retrieved by the network. Checking every 2 minutes...
                      </Typography>
                    </div>
                  )}
                {isPrivate && !admins.includes(myAddress) &&
                !secretKey &&
                triedToFetchSecretKey ? (
                  <>
                    {secretKeyPublishDate ||
                    (!secretKeyPublishDate && !firstSecretKeyInCreation) ? (
                      <div
                        style={{
                          display: "flex",
                          width: "100%",
                          height: isMobile ? `calc(${rootHeight} - 113px)` : "calc(100vh - 70px)",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "20px",
                          overflow: 'auto'
                        }}
                      >
                        {" "}
                        <Typography>
                          You are not part of the encrypted group of members.
                          Wait until an admin re-encrypts the keys.
                        </Typography>
                        <Spacer height="25px" />
                        <Typography>
                          <strong>Only unencrypted messages will be displayed.</strong>
                        </Typography>
                        <Spacer height="25px" />
                        <Typography>
                          Try notifying an admin from the list of admins below:
                        </Typography>
                        <Spacer height="25px" />
                        {adminsWithNames.map((admin) => {
                          return (
                            <Box
                              sx={{
                                display: "flex",
                                gap: "20px",
                                padding: "15px",
                                alignItems: "center",
                              }}
                            >
                              <Typography>{admin?.name}</Typography>
                              <LoadingButton
                                loading={isLoadingNotifyAdmin}
                                loadingPosition="start"
                                variant="contained"
                                onClick={() => notifyAdmin(admin)}
                              >
                                Notify
                              </LoadingButton>
                            </Box>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : admins.includes(myAddress) &&
                  (!secretKey && isPrivate) &&
                  triedToFetchSecretKey ? null : !triedToFetchSecretKey ? null : (
                  <>
                    <GroupAnnouncements
                      myAddress={myAddress}
                      selectedGroup={selectedGroup?.groupId}
                      getSecretKey={getSecretKey}
                      secretKey={secretKey}
                      setSecretKey={setSecretKey}
                      isAdmin={admins.includes(myAddress)}
                      handleNewEncryptionNotification={
                        setNewEncryptionNotification
                      }
                      myName={userInfo?.name}
                      hide={groupSection !== "announcement"}
                      isPrivate={isPrivate}
                    />
                    <GroupForum
                      myAddress={myAddress}
                      selectedGroup={selectedGroup}
                      userInfo={userInfo}
                      getSecretKey={getSecretKey}
                      secretKey={secretKey}
                      setSecretKey={setSecretKey}
                      isAdmin={admins.includes(myAddress)}
                      hide={groupSection !== "forum"}
                      defaultThread={defaultThread}
                      setDefaultThread={setDefaultThread}
                      isPrivate={isPrivate}
                    />
                    {groupSection === "adminSpace" && (
                       <AdminSpace setIsForceShowCreationKeyPopup={setIsForceShowCreationKeyPopup} adminsWithNames={adminsWithNames} selectedGroup={selectedGroup?.groupId} myAddress={myAddress} userInfo={userInfo} hide={groupSection !== "adminSpace"}  isAdmin={admins.includes(myAddress)}
                       />
                    )}
                   
                  </>
                )}

                <Box
                  sx={{
                    display: "flex",
                    position: "absolute",
                    bottom: "25px",
                    right: "25px",
                    zIndex: 100,
                  }}
                >
                  {((isPrivate && admins.includes(myAddress) &&
                    shouldReEncrypt &&
                    triedToFetchSecretKey &&
                    !firstSecretKeyInCreation &&
                    !hideCommonKeyPopup) || isForceShowCreationKeyPopup) && (
                      <CreateCommonSecret
                      isForceShowCreationKeyPopup={isForceShowCreationKeyPopup}
                        setHideCommonKeyPopup={setHideCommonKeyPopup}
                        groupId={selectedGroup?.groupId}
                        secretKey={secretKey}
                        secretKeyDetails={secretKeyDetails}
                        myAddress={myAddress}
                        isOwner={groupOwner?.owner === myAddress}
                        userInfo={userInfo}
                        setIsForceShowCreationKeyPopup={setIsForceShowCreationKeyPopup}
                        noSecretKey={
                          admins.includes(myAddress) &&
                          !secretKey &&
                          triedToFetchSecretKey
                        }
                      />
                    )}
                </Box>
              </Box>
              {openManageMembers && (
                <ManageMembers
                  selectedGroup={selectedGroup}
                  address={myAddress}
                  open={openManageMembers}
                  setOpen={setOpenManageMembers}
                  isAdmin={admins.includes(myAddress)}
                  isOwner={groupOwner?.owner === myAddress}
                />
              )}
            </div>
       

          {selectedDirect && !newChat && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  right: !(desktopViewMode === 'chat') ? "unset" : "0px",
                  bottom: !(desktopViewMode === 'chat') ? "unset" :  "0px",
                  top: !(desktopViewMode === 'chat') ? "unset" :  "0px",
                  background: "#27282c",
                  zIndex: 5,
                  height: isMobile && `calc(${rootHeight} - 45px)`,
                  opacity: !(desktopViewMode === 'chat') ? 0 : 1,
                 
                  left: !(desktopViewMode === 'chat') ? '-100000px' : '0px',
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    flexGrow: 1,
                    display: "flex",
                    height: "100%",
                  }}
                >
                  <ChatDirect
                    myAddress={myAddress}
                    isNewChat={newChat}
                    selectedDirect={selectedDirect}
                    setSelectedDirect={setSelectedDirect}
                    setNewChat={setNewChat}
                    getTimestampEnterChat={getTimestampEnterChat}
                    myName={userInfo?.name}
                    close={() => {
                      setSelectedDirect(null);

                      setNewChat(false);
                    }}
                    setMobileViewModeKeepOpen={setMobileViewModeKeepOpen}
                  />
                </Box>
              </Box>
            </>
          )}
 
            {!isMobile  && (
            <AppsDesktop toggleSideViewGroups={toggleSideViewGroups} toggleSideViewDirects={toggleSideViewDirects} goToHome={goToHome} mode={appsMode} setMode={setAppsMode} setDesktopSideView={setDesktopSideView} hasUnreadDirects={directChatHasUnread} show={desktopViewMode === "apps"} myName={userInfo?.name}  isGroups={isOpenSideViewGroups}
            isDirects={isOpenSideViewDirects}    hasUnreadGroups={groupChatHasUnread ||
              groupsAnnHasUnread} setDesktopViewMode={setDesktopViewMode} isApps={desktopViewMode === 'apps'} desktopViewMode={desktopViewMode} />
          )}
            {!isMobile  && (
            <AppsDevMode toggleSideViewGroups={toggleSideViewGroups} toggleSideViewDirects={toggleSideViewDirects} goToHome={goToHome} mode={appsModeDev} setMode={setAppsModeDev} setDesktopSideView={setDesktopSideView} hasUnreadDirects={directChatHasUnread} show={desktopViewMode === "dev"} myName={userInfo?.name}  isGroups={isOpenSideViewGroups}
            isDirects={isOpenSideViewDirects}    hasUnreadGroups={groupChatHasUnread ||
              groupsAnnHasUnread} setDesktopViewMode={setDesktopViewMode} desktopViewMode={desktopViewMode} isApps={desktopViewMode === 'apps'} />
          )}
      
     
      {!isMobile && (
       
       
        <HomeDesktop
  refreshHomeDataFunc={refreshHomeDataFunc}
  myAddress={myAddress}
  isLoadingGroups={isLoadingGroups}
  balance={balance}
  userInfo={userInfo}
  groups={groups}
  setGroupSection={setGroupSection}
  setSelectedGroup={setSelectedGroup}
  getTimestampEnterChat={getTimestampEnterChat}
  setOpenManageMembers={setOpenManageMembers}
  setOpenAddGroup={setOpenAddGroup}
  setMobileViewMode={setMobileViewMode}
  setDesktopViewMode={setDesktopViewMode}
  desktopViewMode={desktopViewMode}
/>

      )}

    
        </Box>
       
        <AuthenticatedContainerInnerRight
          sx={{
            marginLeft: "auto",
            width: "31px",
            padding: "5px",
            display: (isMobile || desktopViewMode === 'apps' || desktopViewMode === 'dev' || desktopViewMode === 'chat') ? "none" : "flex",
          }}
        >
     
        </AuthenticatedContainerInnerRight>
        <LoadingSnackbar
          open={isLoadingGroup}
          info={{
            message:
              isLoadingGroupMessage || "Setting up group... please wait.",
          }}
        />

        <LoadingSnackbar
          open={isLoadingGroups}
          info={{
            message: "Setting up groups... please wait.",
          }}
        />
      </div>
    </>
  );
};


