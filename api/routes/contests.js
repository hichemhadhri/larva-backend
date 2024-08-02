const express = require("express");
const router = express.Router();
const mongoose = require('mongoose')
const multer = require('multer');
const Post = require("../models/post")
const Contest = require("../models/contest")
const util = require('util')

const checkAuth = require('../middlewares/check_auth');
const fs = require("fs")
require('dotenv').config();
const unlink = util.promisify(fs.unlink)
const path = require("path");

const User = require("../models/user");

const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require("../models/aws");

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
 * Create new contest
 */
router.post("/new", checkAuth, upload.single("file"), async (req, res, next) => {
  try {
    let mediaUrl = '';

    if (req.file) {
      const fileStream = fs.createReadStream(req.file.path);

      const uploadParams = {
        Bucket: process.env.S3_BUCKET,
        Key: req.file.filename,
        Body: fileStream
      };

      const upload = new Upload({
        client: s3Client,
        params: uploadParams
      });

      const upRes = await upload.done();
      await unlink(req.file.path);
      mediaUrl = `contests/${req.file.filename}`;
    }

    const contest = new Contest({
      name: req.body.name,
      description: req.body.description,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      rules: req.body.rules,
      prizes: req.body.prizes,
      createdBy: req.userData.userId,
      mediaUrl: mediaUrl
    });

    const contestSaved = await contest.save();

    // Add the contest to the user's createdContests field
    await User.findByIdAndUpdate(req.userData.userId, {
      $push: { createdContests: contestSaved._id }
    });

    res.status(200).json({
      result: contestSaved
    });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});
/**
 * Delete given contest
 */
router.delete("/:contestId", checkAuth, async (req, res, next) => {
  try {
    const contestId = req.params.contestId;
    const userId = req.userData.userId;

    // Find the contest
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // Check if the user is the creator of the contest
    if (contest.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this contest" });
    }

    // Delete the contest media file from S3
    if (contest.mediaUrl) {
      const key = contest.mediaUrl;
      const deleteParams = {
        Bucket: process.env.S3_BUCKET,
        Key: key
      };
      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
    }

    // Delete the contest from the database
    await Contest.findByIdAndDelete(contestId);

    // Remove the contest reference from the user's createdContests field
    await User.findByIdAndUpdate(userId, {
      $pull: { createdContests: contestId }
    });

    res.status(200).json({ message: "Contest has been deleted" });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});



router.get('/all', checkAuth, async (req, res, next) => {
  try {
    const contests = await Contest.find().exec()

    res.status(200).json(contests)

  } catch (err) {
    const error = new Error(err.message)
    error.status = 500
    next(error)
  }

})

//contest details
router.get("/contest/:contestId", checkAuth, async (req, res, next) => {
  try {
    const contest = await Contest.findById(req.params.contestId).exec()


    res.status(200).json(contest)

  } catch (err) {
    const error = new Error(err.message)
    error.status = 500
    next(error)
  }

})


//return list of posts of a contest
router.get("/posts/:contestId", checkAuth, async (req, res, next) => {
  try {
    const posts = await Post.find({ contests: req.params.contestId }).exec()
    res.status(200).json(posts)
  } catch (err) {
    const error = new Error(err.message)
    error.status = 500
    next(error)
  }
})
const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

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

/**
 * Return top 10 posts of a contest
 */
router.get("/top10/:contestId", async (req, res, next) => {
  try {
    const contestId = req.params.contestId;

    // Ensure the contest exists
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // Get the top 10 posts based on average rating
    const topPosts = await Post.find({ contests: contestId })
      .sort({ averageRating: -1 })
      .limit(10)
      .exec();

    res.status(200).json({ topPosts });
  } catch (err) {
    console.log(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});




router.get("/users/:contestId", checkAuth, async (req, res, next) => {
  try {
    const contestId = req.params.contestId;

    console.log(contestId)

    // Find the contest by ID
    const contest = await Contest.findById(contestId).exec();

    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }

    // Find users who joined the contest
    const users = await User.find({ joinedContests: contest._id }).exec();

    // Return the list of users
    res.status(200).json(users);
  } catch (err) {
    // Log the error message and return a 500 status code
    console.error(err.message);
    const error = new Error(err.message);
    error.status = 500;
    next(error);
  }
});

module.exports = router; 