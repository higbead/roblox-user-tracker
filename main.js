const fetch = require('node-fetch')
const disc = require('discord.js')
const fs = require('fs')
const client = new disc.Client()
const {promisify} = require('util')
const wait = promisify(setTimeout)

let cookie = 'INSERT .ROBLOSECURITY HERE' // Can be any valid .ROBLOSECURITY cookie, but the account used may need to have the tracked users friended depending on their privacy settings.
// Must include .ROBLOSECURITY= and the warning included with the cookie.

let checkfavorites = [
    9, // places
    11, // shirts
    2, // t-shirts
    12, // pants
]

function announce(msg,channels){
    channels.forEach(id=>{
        client.channels.fetch(id,true).then(channel=>{
            channel.send(msg)
        }).catch(err=>{
            console.log('Error while fetching channel:',err)
        })
    })
}
let making = {}
async function makedir(userId){
    if(making[userId]){return}
    making[userId] = true
    console.log('Making cache directory for '+userId)
    
    fs.mkdirSync(`caches/${userId}/favorites`, {recursive: true})

    let fdata = await (await fetch(`https://friends.roblox.com/v1/users/${userId}/friends`)).json()
    fs.writeFileSync(`caches/${userId}/friends.json`,JSON.stringify(fdata.data))

    checkfavorites.forEach(async typeId=>{
        fs.writeFileSync(`caches/${userId}/favorites/${typeId}.json`,await (await fetch(`https://www.roblox.com/users/favorites/list-json?assetTypeId=${typeId}&itemsPerPage=100&pageNumber=1&userId=${userId}`)).text())
    })

    let res = await fetch('https://presence.roblox.com/v1/presence/users',{
        method: 'POST',
        headers: {
            cookie:cookie,
            "content-type":'application/json'
        },
        body: `{"userIds":[${userId}]}`,
    })
    fs.writeFileSync(`caches/${userId}/activity.json`,JSON.stringify((await res.json()).userPresences[0]))
}

function update(){
    let check_users = JSON.parse(fs.readFileSync('check_users.json'))
    let ids = []
    let channels = {}
    check_users.forEach(id=>{
        ids.push(id.userId)
        channels[id.userId] = id.channels
    })
    try{
        fetch('https://presence.roblox.com/v1/presence/users',{
            method: 'POST',
            headers: {
                cookie:cookie,
                "content-type":'application/json'
            },
            body: JSON.stringify({userIds:ids}),
        }).then(async res=>{
            let data = await res.json()
            if(!data.userPresences){
                console.log(data)
                return
            }
            data.userPresences.forEach(async res=>{
                if(!fs.existsSync(`caches/${res.userId}`) || !fs.existsSync(`caches/${res.userId}/activity.json`)){
                    makedir(res.userId)
                    await wait(5000) // Give the system time to create the folder before continuing
                }

                let prev = JSON.parse(fs.readFileSync(`caches/${res.userId}/activity.json`))
                let userData = await (await fetch(`https://users.roblox.com/v1/users/${res.userId}`)).json()
    
                if(res.userPresenceType !== prev.userPresenceType || res.placeId !== prev.placeId){
                    switch(res.userPresenceType){
                        // TODO: Switch to embeds 
                        case 0: // Offline
                            announce(`${userData.name} is now offline. Last location: ${res.lastLocation}`,channels[res.userId])
                            console.log(userData.name,'offline',res.lastLocation)
                            break
                        case 1: // Online
                            announce(`${userData.name} is now online. Location: ${res.lastLocation}`,channels[res.userId])
                            console.log(userData.name,'online',res.lastLocation)
                            break
                        case 2: // Playing
                            if(!res.placeId){
                                announce(`${userData.name} is now playing a game with joins off.`,channels[res.userId])
                            }else{
                                announce(`${userData.name} is now playing a game. https://roblox.com/games/${res.placeId}`,channels[res.userId])
                            }
                            console.log(userData.name,'playing',res.lastLocation,res.placeId)
                            break
                        case 3: // Studio
                            if(!res.placeId){
                                announce(`${userData.name} is now working in studio with joins off.`,channels[res.userId])
                            }else{
                                announce(`${userData.name} is now in studio. https://roblox.com/games/${res.placeId}`,channels[res.userId])
                            }
                            console.log(userData.name,'working on',res.lastLocation,res.placeId)
                            break
                        default: // Unknown
                            announce(`${userData.name} is doin something weird heres the details:\n\`\`\`json\n ${JSON.stringify(res)}\n\`\`\``,channels[res.userId])
                            console.log(userData.name,`Unknown presenceType`,res)
                    }
                    fs.writeFileSync(`caches/${res.userId}/activity.json`,JSON.stringify(res))
                }
            })
            
        }).catch(err=>{
            console.log(err)
        })
    }catch(err){
        console.log(err)
    }
}
async function updateRelations(){
    let check_users = JSON.parse(fs.readFileSync('check_users.json'))
    check_users.forEach(async user=>{
        try{
            if(!fs.existsSync(`caches/${user.userId}`) || !fs.existsSync(`caches/${user.userId}/favorites`)){
                makedir(user.userId)
                await wait(5000) // Give the system time to create the folder before continuing
            }

            let data = await (await fetch(`https://friends.roblox.com/v1/users/${user.userId}/friends`)).json()
            let userData = await (await fetch(`https://users.roblox.com/v1/users/${user.userId}`)).json()
            let old = JSON.parse(fs.readFileSync(`caches/${user.userId}/friends.json`))

            if(data.data.length > old.length){
                data.data.forEach(friend=>{
                    let found = false
                    old.forEach(oldFriend=>{
                        //if(found){return}
                        if(friend.id === oldFriend.id){
                            found = true
                        }
                    })
                    if(!found){
                        announce(`${userData.name} added ${friend.name} as a friend.`,user.channels)
                        console.log(userData.name,'added',friend.name)
                    }
                })
            }else if(old.length > data.data.length){
                old.forEach(friend=>{
                    let found = false
                    data.data.forEach(oldFriend=>{
                        //if(found){return}
                        if(friend.id === oldFriend.id){
                            found = true
                        }
                    })
                    if(!found){
                        announce(`${userData.name} removed ${friend.name} as a friend.`,user.channels)
                        console.log(userData.name,'removed',friend.name)
                    }
                })
            }
            fs.writeFileSync(`caches/${user.userId}/friends.json`,JSON.stringify(data.data))
        
            checkfavorites.forEach(async typeId=>{
                let told = JSON.parse(fs.readFileSync(`caches/${user.userId}/favorites/${typeId}.json`))
                let res = await (await fetch(`https://www.roblox.com/users/favorites/list-json?assetTypeId=${typeId}&itemsPerPage=100&pageNumber=1&userId=${user.userId}`)).json()
                if(res.Data.Items.length > told.Data.Items.length){
                    res.Data.Items.forEach(item=>{
                        let found = false
                        told.Data.Items.forEach(citem=>{
                            //if(found){return}
                            if(item.Item.AssetId === citem.Item.AssetId){
                                found = true
                            }
                        })
                        if(!found){
                            announce(`${userData.name} favorited an asset: ${item.Item.AbsoluteUrl || '`'+JSON.stringify(item)+'`'}`,user.channels)
                            console.log(userData.name,'favorited',item.Item.AbsoluteUrl)
                        }
                    })
                }else if(res.Data.Items.length < told.Data.Items.length){
                    told.Data.Items.forEach(item=>{
                        let found = false
                        res.Data.Items.forEach(citem=>{
                            //if(found){return}
                            if(item.Item.AssetId === citem.Item.AssetId){
                                found = true
                            }
                        })
                        if(!found){
                            announce(`${userData.name} unfavorited an asset: ${item.Item.AbsoluteUrl || '`'+JSON.stringify(item)+'`'}`,user.channels)
                            console.log(userData.name,'unfavorited',item.Item.AbsoluteUrl)
                        }
                    })
                }
                fs.writeFileSync(`caches/${user.userId}/favorites/${typeId}.json`,JSON.stringify(res))
            })
        }catch(err){
            console.log(err)
        }
    })

}

client.login('INSERT BOT TOKEN HERE').then(()=>{
    setInterval(update,10000)
    update()
    setInterval(updateRelations,60000)
    updateRelations()
}).catch(err=>{
    console.log('Failed to login: '+err)
})
