import os
import rawpy
import imageio
import argparse

def convert_raw_to_jpeg(dir_path):
    if not os.path.exists(os.path.join(dir_path,'jpegs')):
        os.makedirs(os.path.join(dir_path,'jpegs'))

    for filename in os.listdir(dir_path):
        if filename.lower().endswith(('.nef', '.cr2', '.arw', '.dng')):  # Add other RAW formats as needed
            file_path = os.path.join(dir_path, filename)
            output_file_path = os.path.join(dir_path,'jpegs', filename[0:-4] + '.jpg')

            with rawpy.imread(file_path) as raw:
                try:
                    thumb = raw.extract_thumb()
                    if thumb.format == rawpy.ThumbFormat.JPEG:
                        with open(output_file_path, 'wb') as f:
                            f.write(thumb.data)
                    elif thumb.format == rawpy.ThumbFormat.BITMAP:
                        imageio.imsave(output_file_path, thumb.data)
                except (rawpy.LibRawNoThumbnailError, rawpy.LibRawUnsupportedThumbnailError):
                    print(f'No thumbnail or unsupported thumbnail format for {filename}. Converting raw data to JPEG...')
                    rgb = raw.postprocess()
                    imageio.imsave(output_file_path, rgb)
        elif filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            file_path = os.path.join(dir_path, filename)
            output_file_path = os.path.join(dir_path,'jpegs', filename)
            imageio.imwrite(output_file_path, imageio.v2.imread(file_path))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Convert raw images to JPEG')
    parser.add_argument('dir_path', type=str, help='Directory containing the raw images')

    args = parser.parse_args()

    convert_raw_to_jpeg(args.dir_path)
