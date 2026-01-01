const Notification = require('../models/Notification');

/**
 * @desc    Get user's notifications
 * @route   GET /api/notifications
 * @access  Private (All roles)
 */
const getMyNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
    
    const query = { userId: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (Owner only)
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check ownership
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private (All roles)
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
};

/**
 * Helper function to create a notification
 * Used internally by other controllers
 */
const createNotification = async ({
  userId,
  role,
  type,
  message,
  relatedEntityId,
  relatedEntityType
}) => {
  try {
    return await Notification.create({
      userId,
      role,
      type,
      message,
      relatedEntityId,
      relatedEntityType
    });
  } catch (error) {
    console.error('Create notification error:', error);
    // Don't throw - notifications should not block main operations
    return null;
  }
};

/**
 * Helper to notify multiple users
 */
const notifyUsers = async (userIds, notificationData) => {
  try {
    const notifications = userIds.map(userId => ({
      ...notificationData,
      userId
    }));
    return await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Bulk notification error:', error);
    return [];
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  notifyUsers
};
