"use server"
import { revalidatePath } from '@/node_modules/next/cache';
import Thread from '../models/thread.model';
import User from '../models/user.model';
import { connectToDB } from './../mongoose';
interface Params {
    text: string,
    author: string,
    communityId:string | null,
    path: string,
}

export async function createThread({ text,author,communityId,path }:Params) {
        try {
             connectToDB();
     const createdThread =await Thread.create({
        text,
        author,
        community:null,
     });
     //Update user Model
     await User.findByIdAndUpdate(author,{
        $push: {
            threads:createdThread._id
        }
     })
     revalidatePath(path)
        } catch (error:any) { 
            throw new Error(`Error creating thread : ${error.message}`)
        }
   
}

export async function fetchPosts(pageNumber=1,pageSize=20) {
    const skipAmount  = (pageNumber-1)* pageSize;

    connectToDB();
    const postQuery = Thread.find({parentId:{$in:[null,undefined]}})
    .sort({createdAt:'desc'})
    .skip(skipAmount)
    .limit(pageSize)
    .populate({path:'author',model: User})
    .populate({
        path:'children',
        populate:{
            path:'author',
            model:User,
            select:"_id name parentId image"
        }
    })
    const totalPostCount = await Thread.countDocuments({parentId:{$in:[null,undefined]}})
    const posts = await postQuery.exec();
    const isNext = totalPostCount>skipAmount + posts.length;
    return {posts, isNext} 
}

export async function fetchThreadById(id:string) {
    connectToDB();
    try {
        //todo: populate community 
        const thread = await Thread.findById(id)
        .populate({
            path:'author',
            model: User,
            select:"_id id name image"
        })
        .populate({
            path:'children',
            populate:[
                {
                    path:'author',
                    model:User,
                    select:'_id id name parentId image'
                },
                {
                    path:'children',
                    model:Thread,
                    populate:{
                        path:'author',
                        model: User,
                        select:"_id id name parentId image"
                    }
                }
            ]
        }).exec();
        return thread;
    } catch (error:any) {
        throw new Error(`error Fetching thread : ${error}`);

    }
}

export async function addCommentToThread(
    threadId: string,
    commentText:string,
    userId: string,
    path: string,
    ) {
    connectToDB();
    try {
        //find the original thread by its id 
        const originalThread = await Thread.findById(threadId);
        if(!originalThread){
            throw new Error("Thread Not found")
        }
        const commentThread = new Thread({
            text: commentText,
            author:userId,
            parentId: threadId,
        })
        const savedCommentThread = await commentThread.save();
        originalThread.children.push(savedCommentThread._id);
        await originalThread.save();
        revalidatePath(path);
    } catch (error:any) {
        throw new Error(`Error adding comment  to thread : ${error.message}`)
    }
}