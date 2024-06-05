from images import *
from registration import Registration
import cv2

# download_images(37, 242186, 20)
control = select_control_image('downloaded_images')
control = f"downloaded_images\{control}"
control_img = cv2.imread(control)
cv2.imwrite("control.jpg", control_img)
mask = generate_mask(control)
register = Registration(control, mask)
register.generate_registrations()

# masked_image = cv2.bitwise_and(control_img, control_img, mask=mask)
# cv2.imwrite('masked_image.jpg', masked_image)
# cv2.imshow("Selected Control Image", control)
# cv2.imshow("Masked Image", masked_image)
# cv2.waitKey(0)
# cv2.destroyAllWindows()