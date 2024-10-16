import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

export const registerUser = asyncHandler(async function (req, res) {
  // get user details from frontend
  // validate each field if it is not empty.
  // check user is already exist or not. ==> username, email
  // check images or check for avatar.
  // upload them to cloudinary.
  // create user object and save in db.
  // remove password and refresh token field from user object
  // check for user creation
  // res.

  const { fullName, username, email, password } = req.body;
  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with the email or username is already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files?.coverImage &&
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(500, "Internal cloudinary upload error");
  }

  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = user
    ? await User.findById(user._id).select("-password -refreshToken")
    : null;
  if (!createdUser) {
    throw new ApiError(500, "Internal database error");
  }
  return res.status(201).json(new ApiResponse(201, createdUser));
});

export const loginUser = asyncHandler(async function (req, res) {
  // get username or email and password from frontent
  // check if any of these field is empty
  // find user by username of email,
  // check password is correct
  // generate access token and refresh token
  // send access token and refresh token in cookie
  // send response

  const { username, email, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  if (!password.trim()) {
    throw new ApiError(401, "invalid credential");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "user does not exist");
  }

  const isPasswordValid = user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid credential");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const cookieOptions = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { loggedInUser, accessToken, refreshToken },
        "Success"
      )
    );
});

export const logoutUser = asyncHandler(async function (req, res) {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Success"));
});

async function generateAccessAndRefreshToken(userId) {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
}

export const refreshAccessToken = asyncHandler(async function (req, res) {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    if (!decodedToken) {
      throw new ApiError(401, "invalid refresh token");
    }

    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "refresh token expired or used");
    }

    const cookieOptions = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(new ApiResponse(200, { accessToken, refreshToken }, "Success"));
  } catch (error) {
    throw new ApiError(500, error.message || "internal server error");
  }
});

export const changeCurrentPassword = asyncHandler(async function (req, res) {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "unauthorized access wrong password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Success"));
});

export const updateUserDetails = asyncHandler(async function (req, res) {
  const { fullName, email } = req.body;

  let newUserDetails;

  if (fullName) {
    newUserDetails = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { fullName },
      },
      { new: true }
    ).select("-password -refreshToken");
  }
  if (email) {
    newUserDetails = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { email },
      },
      { new: true }
    ).select("-password -refreshToken");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { user: newUserDetails }, "Success"));
});

export const updateUserAvatar = asyncHandler(async function (req, res) {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(500, "Error can't get avatar url from cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(201).json(new ApiResponse(201, { user }, "Success"));
});

export const updateUserCoverImage = asyncHandler(async function (req, res) {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "Error can't get coverImage url from cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(201).json(new ApiResponse(201, { user }, "Success"));
});

export const getCurrentUser = asyncHandler(async function (req, res) {
  return res
    .status(200)
    .json(new ApiResponse(200, { user: req.user }, "Success"));
});
