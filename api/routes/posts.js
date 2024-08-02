const express = require("express");
const router = express.Router();
const mongoose = require('mongoose')
const multer = require('multer');
const Post = require("../models/post")
const FormData = require("form-data");
const rgb2hex = require('rgb2hex');
const fs = require("fs")
const s3Client = require("../models/aws");


const util = require('util')
const unlink = util.promisify(fs.unlink)
const path = require("path");

const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');


const { Readable } = require('stream');

require('dotenv').config();


const { Upload } = require('@aws-sdk/lib-storage');

//For video Handling
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);




const checkAuth = require('../middlewares/check_auth');

const User = require("../models/user");
const post = require("../models/post");
const Contest = require("../models/contest");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,

});

/**
 * Create a new post
 */
router.post('/new', checkAuth, upload.fields([{ name: 'file' }, { name: 'thumbnail' }]), async (req, res, next) => {
  const id = new mongoose.Types.ObjectId();
  const filePath = req.files['file'][0].path;
  const fileExtension = filePath.split('.').pop().toLowerCase();
  const isVideo = ['mp4', 'mov', 'avi'].includes(fileExtension);
  let thumbnailUrl = '';

  const contests = JSON.parse(req.body.contests); // This is a stringified JSON object




  try {
    let mediaUrl = `${id.toString()}`;

    if (isVideo) {
      const hlsDir = `uploads/hls-${id}`;
      fs.mkdirSync(hlsDir);

      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .outputOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls',
            `-hls_segment_filename ${hlsDir}/${mediaUrl}-index%d.ts`,
          ])
          .output(`${hlsDir}/index.m3u8`)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const files = fs.readdirSync(hlsDir);
      for (const file of files) {
        const fileStream = fs.createReadStream(path.join(hlsDir, file));
        const key = file.endsWith('.m3u8') ? `${mediaUrl}-${file}` : `${file}`;
        const uploadParams = {
          Bucket: process.env.S3_BUCKET,
          Body: fileStream,
          Key: key,
        };
        const upload = new Upload({
          client: s3Client,
          params: uploadParams,
        });
        await upload.done();
      }

      await unlink(filePath);
      fs.rmSync(hlsDir, { recursive: true });

      mediaUrl = `posts/${mediaUrl}-index.m3u8`;

      if (req.files['thumbnail']) {
        const thumbnailPath = req.files['thumbnail'][0].path;
        const thumbnailStream = fs.createReadStream(thumbnailPath);
        const thumbnailKey = `${id.toString()}-thumbnail.jpg`;
        const thumbnailUploadParams = {
          Bucket: process.env.S3_BUCKET,
          Body: thumbnailStream,
          Key: thumbnailKey,
        };
        const thumbnailUpload = new Upload({
          client: s3Client,
          params: thumbnailUploadParams,
        });
        await thumbnailUpload.done();
        await unlink(thumbnailPath);
        thumbnailUrl = `posts/${thumbnailKey}`;
      }
    } else {
      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: process.env.S3_BUCKET,
        Body: fileStream,
        Key: mediaUrl,
      };

      const upload = new Upload({
        client: s3Client,
        params: uploadParams,
      });
      await upload.done();
      await unlink(filePath);
      mediaUrl = `posts/${mediaUrl}`;
      thumbnailUrl = mediaUrl; // For images, the thumbnail is the image itself
    }



    const post = new Post({
      _id: id,
      title: req.body.title,
      description: req.body.description,
      author: req.userData.userId,
      mediaUrl: mediaUrl,
      mediaType: isVideo ? 'video' : 'image',
      thumbnail: thumbnailUrl,
      contests: contests,
      domains: req.body.domains,
      backgroundColor: req.body.backgroundColor,
    });

    const postSaved = await post.save();

    await Contest.updateMany(
      { _id: { $in: contests } },
      { $push: { posts: postSaved._id } }
    );

    await Contest.updateMany(
      { _id: { $in: contests } },
      { $addToSet: { users: req.userData.userId } }
    );

    await User.findByIdAndUpdate(req.userData.userId, {
      $addToSet: { joinedContests: { $each: contests } }
    });

    await User.findByIdAndUpdate(req.userData.userId, {
      $push: { posts: postSaved._id }
    }).exec();

    res.status(200).json({
      result: postSaved
    });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});


/**
 * Delete given post
 */
router.delete("/:postId", checkAuth, async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const userId = req.userData.userId;

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the user is the owner of the post
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    // This will trigger the pre-remove middleware
    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});


//return list of posts
router.get("/wall", checkAuth, async (req, res, next) => {
  try {
    const posts = await Post.find().exec()
    res.status(200).json(posts)
  } catch (err) {
    const error = new Error(err.message)
    error.status = 500
    next(error)
  }
})




/**
 * Return post media (no need for checkAuth)
 */
router.get("/:key", async (req, res, next) => {
  try {
    console.log('Requested key: ' + req.params.key);
    const downloadParams = {
      Key: req.params.key,
      Bucket: process.env.S3_BUCKET
    };

    // Get the object metadata to determine the content type
    const headCommand = new HeadObjectCommand(downloadParams);
    const headResult = await s3Client.send(headCommand);
    const contentType = headResult.ContentType;

    res.setHeader('Content-Type', contentType);

    const getObjectCommand = new GetObjectCommand(downloadParams);
    const response = await s3Client.send(getObjectCommand);

    // Stream the body to the response
    const bodyStream = response.Body;

    if (bodyStream instanceof Readable) {
      bodyStream.pipe(res).on('error', function (err) {
        console.error('Stream error:', err);
        next(err);
      });
    } else {
      console.error('Body is not a stream:', response.Body);
      res.status(500).json({ message: 'Error: Body is not a stream' });
    }
  } catch (err) {
    console.error('Error occurred:', err);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});

// return post  
router.get("/post/:id", checkAuth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).exec();

    res.status(200).json(post);
  } catch (err) {
    const error = new Error(err.message)

    error.status = err.status
    next(error)
  }
});


/**
 * Update post title and description
 */
router.put("/:postId", checkAuth, async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const userId = req.userData.userId;
    const { title, description } = req.body;
    console.log(req.body);
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the user is the owner of the post
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    // Update the post
    post.title = title || post.title;
    post.description = description || post.description;
    post.updatedAt = Date.now();

    const updatedPost = await post.save();

    res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost
    });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});


/**
 * rate a post
 */
router.post("/rate/:postId", checkAuth, async (req, res, next) => {
  try {
    console.log(req.body);
    const postId = req.params.postId;
    const userId = req.userData.userId;

    const rating = req.body.rating;
    const timespent = req.body.timespent;

    // rating must be between 1 and 5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the user has already rated the post
    const userRating = post.ratings.find(rating => rating.user.toString() === userId.toString());
    if (userRating) {
      return res.status(403).json({ message: "User has already rated this post" });
    }

    // Add the rating
    post.ratings.push({ user: userId, rating: rating, timespent: timespent });
    post.averageRating = post.ratings.reduce((acc, curr) => acc + curr.rating, 0) / post.ratings.length;
    post.averageTimeSpent = post.ratings.reduce((acc, curr) => acc + curr.timespent, 0) / post.ratings.length;

    const updatedPost = await post.save();

    // Add the rating to the user's ratings field
    const user = await User.findById(userId);
    user.ratings.push({ post: postId, rating: rating });
    await user.save();

    res.status(200).json({
      message: "Post rated successfully",
      post: updatedPost
    });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});

/**
 * Get all posts by a user
 */
router.get("/user/:userId", checkAuth, async (req, res, next) => {
  try {
    const posts = await Post.find({ author: req.params.userId }).exec();
    res.status(200).json(posts);
  } catch (err) {
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
}
);


/**
 * Add post to user's favoritePosts
 */
router.post("/favorite/:postId", checkAuth, async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const userId = req.userData.userId;

    // Add the post to the user's favoritePosts if it's not already present
    await User.findByIdAndUpdate(userId, {
      $addToSet: { favoritePosts: postId }
    });

    // Add the user to the post's fans if not already present
    await Post.findByIdAndUpdate(postId, {
      $addToSet: { fans: userId }
    });


    res.status(200).json({
      message: "Post added to favorites successfully"
    });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});


module.exports = router; 