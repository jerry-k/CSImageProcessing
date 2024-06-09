from images import *
from registration import Registration
import cv2

# Example of downloading images from the Manly site, and generating registrations
download_images(topic_id=37, root_id=242186, no_images=20)
control = select_control_image('raw')
control = f"raw\{control}"
control_img = cv2.imread(control)
cv2.imwrite("control.jpg", control_img)
mask = generate_mask(control)
register = Registration(control, mask)
register.generate_registrations()