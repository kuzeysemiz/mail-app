"use client";
import ReactQuill, { Quill } from "react-quill-new";
import ImageResize from "quill-image-resize-module-react";

Quill.register("modules/imageResize", ImageResize);

export { Quill };
export default ReactQuill;
